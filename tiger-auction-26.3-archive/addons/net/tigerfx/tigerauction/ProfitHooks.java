package net.tigerfx.tigerauction;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents;

/** Records actual server-originated economy messages, not ordinary chat. */
public final class ProfitHooks implements ClientModInitializer {
    @Override public void onInitializeClient() {
        EconomyMonitor263.install();
        ClientReceiveMessageEvents.GAME.register((message,overlay) -> {
            if (!overlay && message != null) ProfitLedger.onGameMessage(message.getString());
        });
    }
}
