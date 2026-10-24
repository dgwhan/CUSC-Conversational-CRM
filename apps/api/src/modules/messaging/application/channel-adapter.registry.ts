import { Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { Channel } from "../domain/channel.js";
import { ChannelAdapter } from "../domain/channel-adapter.port.js";

export const CHANNEL_ADAPTERS = Symbol('CHANNEL_ADAPTERS');

@Injectable()
export class ChannelAdapterRegistry {
    private readonly map = new Map<Channel, ChannelAdapter>();

    constructor(@Optional() @Inject(CHANNEL_ADAPTERS) adapters: ChannelAdapter[] = []) {
        adapters.forEach((a) => this.map.set(a.channel, a));
    }

    register(adapter: ChannelAdapter): void {
        this.map.set(adapter.channel, adapter);
    }

    get(channel: Channel): ChannelAdapter {
        const adapter = this.map.get(channel);
        if (!adapter) throw new NotFoundException(`Unsupported channel: ${channel}`);
        return adapter;
    }
}
