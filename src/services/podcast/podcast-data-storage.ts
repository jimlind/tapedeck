import { RESOLVER } from 'awilix';
import bettersqlite3 from 'better-sqlite3';
import { CacheDictionary } from '../../models/cache-dictionary.js';
import { PodcastFeedRow } from '../../models/db/podcast-feed-row.js';
import { Podcast } from '../../models/podcast.js';

export class PodcastDataStorage {
    static [RESOLVER] = {};

    db: bettersqlite3.Database;
    postedCache: CacheDictionary;

    constructor(betterSqlite3: typeof bettersqlite3) {
        this.db = betterSqlite3('./db/podcasts.db');
        this.postedCache = new CacheDictionary(5);

        this.setup();
    }

    setup() {
        this.db.exec(
            'CREATE TABLE IF NOT EXISTS feeds (id TEXT PRIMARY KEY, url TEXT UNIQUE, title TEXT)',
        );
        this.db.exec(
            'CREATE TABLE IF NOT EXISTS channels (feed_id TEXT, channel_id TEXT, UNIQUE(feed_id, channel_id))',
        );
        this.db.exec(
            'CREATE TABLE IF NOT EXISTS posted (feed_id TEXT PRIMARY KEY UNIQUE, guid TEXT)',
        );
        this.cachePostedDataLocally();
    }

    cachePostedDataLocally() {
        const allRows = this.db
            .prepare('SELECT f.url, p.guid FROM feeds f LEFT JOIN posted p ON f.id = p.feed_id')
            .all();

        // Dumb loop so it is simple and synchronous
        for (var x = 0; x < allRows.length; x++) {
            const row = allRows[x];
            const url = row.url || '';
            const guidList = (row.guid || '').split(',').filter(Boolean);
            for (var y = 0; y < guidList.length; y++) {
                this.postedCache.add(url, guidList[y]);
            }
        }
    }

    addFeed(podcast: Podcast, channelId: string) {
        // Add the feed to the posted cache because that's what the loop gets data from
        // Copying existing data over is easier than seeing if it exists and only inserting if it exists
        this.getPostedFromUrl(podcast.feed).forEach((guid) => {
            this.postedCache.add(podcast.feed, guid);
        });

        this.db
            .prepare(
                'INSERT OR IGNORE INTO feeds (id, url, title) VALUES (lower(hex(randomblob(3))), ?, ?)',
            )
            .run(podcast.feed, podcast.title);

        const feedId =
            this.db
                .prepare('SELECT id FROM feeds WHERE url = ? LIMIT 1')
                .pluck()
                .get(podcast.feed) || '';

        this.db
            .prepare('INSERT OR IGNORE INTO channels (feed_id, channel_id) VALUES (?, ?)')
            .run(feedId, channelId);
    }

    removeFeed(feedId: string, channelId: string) {
        this.db
            .prepare('DELETE FROM channels WHERE feed_id = ? AND channel_id = ?')
            .run(feedId, channelId);
    }

    getFeedCount(): number {
        return this.postedCache.count();
    }

    getFeedsByChannelId(channelId: string): PodcastFeedRow[] {
        return this.db
            .prepare(
                'SELECT id, title FROM feeds INNER JOIN channels ON feeds.id = channels.feed_id WHERE channel_id = ? ORDER BY title',
            )
            .all(channelId)
            .map((dataRow) => {
                const row = new PodcastFeedRow();
                row.id = dataRow.id || '';
                row.title = dataRow.title || '';
                return row;
            });
    }

    getChannelsByFeedUrl(feedUrl: string): Array<string> {
        return this.db
            .prepare(
                'SELECT channel_id FROM channels c INNER JOIN feeds f ON c.feed_id = f.id WHERE f.url = ?',
            )
            .pluck()
            .all(feedUrl);
    }

    getFeedByFeedId(feedId: string): PodcastFeedRow | null {
        const data = this.db.prepare('SELECT id, url, title FROM feeds WHERE id = ?').get(feedId);

        if (!data) {
            return null;
        }

        const podcastFeedRow = new PodcastFeedRow();
        podcastFeedRow.id = data?.id || '';
        podcastFeedRow.url = data?.url || '';
        podcastFeedRow.title = data?.title || '';

        return podcastFeedRow;
    }

    getPostedFeeds(): Array<string> {
        return this.postedCache.getAllKeys();
    }

    updatePostedData(url: string, guid: string) {
        // Update the local cache
        this.postedCache.add(url, guid);

        const feedId = this.db.prepare('SELECT id FROM feeds WHERE url = ?').pluck().get(url);
        this.db.prepare('REPLACE INTO posted (feed_id, guid) VALUES (?, ?)').run(feedId, guid);
    }

    resetPostedData() {
        this.db.prepare("UPDATE posted SET guid = ''").run();
        this.cachePostedDataLocally();
    }

    getPostedFromUrl(url: string): string[] {
        return this.postedCache.get(url);
    }

    close() {
        this.db.close();
    }
}
