package com.tigerfx.tigermacro;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.util.Identifier;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Main client entrypoint. Runtime macro state has exactly one owner: MacroController. */
public final class TigerMacroClient implements ClientModInitializer {
    public static final String MOD_ID = "tiger_macro";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);
    public static final KeyBinding.Category KEY_CATEGORY = KeyBinding.Category.create(
            Identifier.of(MOD_ID, "controls")
    );

    public static KeyBinding ENABLE_DISABLE_KEY;
    public static KeyBinding MECHANIZED_KEY;
    public static KeyBinding OPEN_CONFIG_KEY;

    private static MacroConfig config;
    private static MacroController controller;

    @Override
    public void onInitializeClient() {
        config = MacroConfig.load();

        // This is now the sole macro on/off control. The old F7 Toggle Key is removed.
        ENABLE_DISABLE_KEY = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.tiger_macro.global", GLFW.GLFW_KEY_F8, KEY_CATEGORY));
        MECHANIZED_KEY = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.tiger_macro.mechanized", GLFW.GLFW_KEY_SPACE, KEY_CATEGORY));
        OPEN_CONFIG_KEY = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.tiger_macro.open_config", GLFW.GLFW_KEY_F6, KEY_CATEGORY));

        controller = new MacroController(config);

        ClientTickEvents.END_CLIENT_TICK.register(TigerMacroClient::onClientTick);
        ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> controller.resetMacroState());

        LOGGER.info("Tiger Macro initialized. Default delay: {}ms", config.getDelayMs());
    }

    private static void onClientTick(MinecraftClient client) {
        if (client.currentScreen != null || !isWindowFocused(client)) {
            drainKeyPresses();
            controller.resetMacroState();
            return;
        }

        processEnableDisableToggle();
        processConfigOpen(client);
        drainMechanizedControlPresses();
        controller.tick(client);
    }

    static boolean isWindowFocusedForController(MinecraftClient client) {
        return isWindowFocused(client);
    }

    static boolean isWindowFocused(MinecraftClient client) {
        long handle = client.getWindow().getHandle();
        return handle != 0L && GLFW.glfwGetWindowAttrib(handle, GLFW.GLFW_FOCUSED) == GLFW.GLFW_TRUE;
    }

    private static void processEnableDisableToggle() {
        if (hasControlConflict(ENABLE_DISABLE_KEY)) {
            drainKeyPressesFor(ENABLE_DISABLE_KEY);
            return;
        }

        while (ENABLE_DISABLE_KEY.wasPressed()) {
            controller.toggleMacro();
        }
    }

    private static void processConfigOpen(MinecraftClient client) {
        if (hasControlConflict(OPEN_CONFIG_KEY)) {
            drainKeyPressesFor(OPEN_CONFIG_KEY);
            return;
        }

        while (OPEN_CONFIG_KEY.wasPressed()) {
            client.setScreen(new MacroConfigScreen(client, null));
        }
    }

    private static boolean hasControlConflict(KeyBinding binding) {
        InputUtil.Key key = MacroKeybinds.getBoundKey(binding);
        if (key.equals(MacroKeybinds.getBoundKey(ENABLE_DISABLE_KEY)) && binding != ENABLE_DISABLE_KEY) return true;
        if (key.equals(MacroKeybinds.getBoundKey(MECHANIZED_KEY)) && binding != MECHANIZED_KEY) return true;
        if (key.equals(MacroKeybinds.getBoundKey(OPEN_CONFIG_KEY)) && binding != OPEN_CONFIG_KEY) return true;
        return false;
    }

    private static void drainMechanizedControlPresses() {
        while (MECHANIZED_KEY.wasPressed()) {
            // This binding only stores the configurable target key. Its physical press must not toggle anything.
        }
    }

    private static void drainKeyPresses() {
        drainKeyPressesFor(ENABLE_DISABLE_KEY);
        drainKeyPressesFor(MECHANIZED_KEY);
        drainKeyPressesFor(OPEN_CONFIG_KEY);
    }

    private static void drainKeyPressesFor(KeyBinding key) {
        while (key.wasPressed()) {
            // Discard stale queued input when gameplay controls are unavailable.
        }
    }

    public static MacroConfig getConfig() {
        return config;
    }

    public static MacroController getController() {
        return controller;
    }

    public static void reloadConfiguration() {
        if (controller != null) {
            controller.resetMacroState();
        }
        config = MacroConfig.load();
        if (controller != null) {
            controller.setConfig(config);
        }
    }
}
