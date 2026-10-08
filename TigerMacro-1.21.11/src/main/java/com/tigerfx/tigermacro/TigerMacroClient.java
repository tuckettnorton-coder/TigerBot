package com.tigerfx.tigermacro;

import com.tigerfx.tigermacro.config.MacroConfig;
import com.tigerfx.tigermacro.input.InputManager;
import com.tigerfx.tigermacro.input.MacroKeybinds;
import com.tigerfx.tigermacro.macro.MacroManager;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.MinecraftClient;

public final class TigerMacroClient implements ClientModInitializer {
    private static MacroConfig config;
    private static MacroManager macroManager;
    private static InputManager inputManager;

    @Override
    public void onInitializeClient() {
        config = MacroConfig.load();
        MacroKeybinds.loadFromConfig(config);
        MacroKeybinds.syncToConfig(config);

        macroManager = new MacroManager(MinecraftClient.getInstance(), config);
        inputManager = new InputManager(config, macroManager);
        macroManager.initializeFromConfig();

        ClientTickEvents.END_CLIENT_TICK.register(client -> inputManager.tick(client));
        ClientLifecycleEvents.CLIENT_STOPPING.register(client -> shutdown());
    }

    private static void shutdown() {
        if (macroManager != null) {
            macroManager.shutdown();
            macroManager = null;
        }
        if (config != null) {
            config.save();
        }
        inputManager = null;
    }
}