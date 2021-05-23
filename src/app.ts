#!/usr/bin/env node

import { Client as DiscordClient } from 'discord.js';
import { Logger } from 'log4js';
import onExit from 'signal-exit';
import { Container } from './container.js';
import { Podcast } from './models/podcast.js';
import { Bot } from './services/bot.js';
import { DiscordConnection } from './services/discord/discord-connection';
import { PodcastDataStorage } from './services/podcast/podcast-data-storage';
import { PodcastProcessor } from './services/podcast/podcast-processor';

// Initialize the container
const container: Container = new Container();
container.register().then(() => {
    // Activate the Discord connection
    container
        .resolve<DiscordConnection>('discordConnection')
        .getConnectedClient()
        .then((discordClient: DiscordClient) => {
            // Log a message on successful connection
            const serverCount: Number = discordClient.guilds.cache.size;
            const logger = container.resolve<Logger>('logger');
            logger.debug(`Discord Client Logged In on ${serverCount} Servers`);

            // Open the database connection
            const data = container.resolve<PodcastDataStorage>('podcastDataStorage');

            // Keeps track of if an active diary entry thread is running
            let threadRunning: boolean = false;
            let interval: NodeJS.Timeout;
            const processRestInterval: number = 60000; // Give it up to 60 seconds to rest

            data.setup().then(() => {
                data.getPostedData().then((postedData: any) => {
                    interval = setInterval(() => {
                        if (threadRunning) return;

                        const feeds = [
                            'https://feeds.simplecast.com/DPfrjtYE', // Film Hags
                            'https://anchor.fm/s/184b0a38/podcast/rss', // Bat & Spider
                            'https://anchor.fm/s/23694498/podcast/rss', // Will Run For...
                            'https://anchor.fm/s/3a0acd20/podcast/rss', // Cinenauts
                            'https://anchor.fm/s/12d1fabc/podcast/rss', // 70mm
                            'https://anchor.fm/s/238d77c8/podcast/rss', // Dune Pod
                            'https://anchor.fm/s/3ae14da0/podcast/rss', // Lost Light
                        ];

                        const channels = [
                            '799785154032959528', // Bot Dev Channel
                            '842188710393151519', // TAPEDECK Feed Channel
                        ];

                        const processor = container.resolve<PodcastProcessor>('podcastProcessor');
                        const bot = container.resolve<Bot>('bot');

                        let feedCount = 1; // Adjust for length index-zero
                        feeds.forEach((feedUrl: string, index: number) => {
                            setTimeout(() => {
                                processor.process(feedUrl).then((podcast: Podcast) => {
                                    // Prodcast fetching and process completed (the hard part)
                                    // Allow the thread to start again
                                    if (feedCount++ === feeds.length) {
                                        threadRunning = false;
                                    }

                                    // Exit early if the podcast is already latest
                                    if (bot.podcastIsLatest(podcast)) {
                                        return;
                                    }

                                    // Write podcast to a channel list
                                    bot.writePodcastToChannelList(podcast, channels);
                                });
                            }, 1000 * index);
                        });

                        threadRunning = true;
                    }, processRestInterval);
                });
            });

            // Clean up when process is told to end
            onExit((code: any, signal: any) => {
                discordClient.destroy();
                data.close();
                logger.debug(`Program Terminated ${code}:${signal}`);
            });
        });
});
