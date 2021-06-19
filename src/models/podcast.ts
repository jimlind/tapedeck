import normalizeUrl from 'normalize-url';
import { PodcastEpisode } from './podcast-episode';

export class Podcast {
    private _title: string = '';
    public get title(): string {
        return this._title;
    }
    public set title(value: string) {
        this._title = value;
    }

    private _author: string = '';
    public get author(): string {
        return this._author;
    }
    public set author(value: string) {
        this._author = value;
    }

    private _image: string = '';
    public get image(): string {
        return this._image;
    }
    public set image(value: string) {
        this._image = value;
    }

    private _link: string = '';
    public get link(): string {
        return normalizeUrl(this._link);
    }
    public set link(value: string) {
        this._link = value;
    }

    private _feed: string = '';
    public get feed(): string {
        return this._feed;
    }
    public set feed(value: string) {
        this._feed = value;
    }

    private _episodeList: PodcastEpisode[] = [];
    public get episodeList(): PodcastEpisode[] {
        return this._episodeList;
    }
    public set episodeList(value: PodcastEpisode[]) {
        this._episodeList = value;
    }
}
