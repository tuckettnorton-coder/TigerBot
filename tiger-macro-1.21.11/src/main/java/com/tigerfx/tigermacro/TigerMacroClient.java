package com.tigerfx.tigermacro;

import com.tigerfx.tigermacro.mixin.MinecraftClientInvokerMixin;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientWorldEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.util.Identifier;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Main client entrypoint. Runtime macro state has exactly one owner:
 * MacroController.
 */
public final class TigerMacroClient implements ClientModInitializer {
    public static final String MOD_ID = "tiger_macro";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);
    public static final KeyBinding.Category KEY_CATEGORY = KeyBinding.Category.create(
            Identifier.of(MOD_ID, "controls")
    );

    public static KeyBinding TOGGLE_MACRO_KEY;
    public static KeyBinding TOGGLE_GLOBAL_KEY;
    public static KeyBinding OPEN_CONFIG_KEY;

    private static MacroConfig config;
    private static MacroController controller;

    @Override
    public void onInitializeClient() {
        config = MacroConfig.load();

        TOGGLE_MACRO_KEY = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.tiger_macro.toggle",
                GLFW.GLFW_KEY_F7,
                KEY_CATEGORY
        ));
        TOGGLE_GLOBAL_KEY = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.tiger_macro.global",
                GLFW.GLFW_KEY_F8,
                KEY_CATEGORY
        ));
        OPEN_CONFIG_KEY = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.tiger_macro.open_config",
                GLFW.GLFW_KEY_F6,
                KEY_CATEGORY
        ));

        controller = new MacroController(config);

        ClientTickEvents.END_CLIENT_TICK.register(TigerMacroClient::onClientTick);
        ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> controller.resetMacroState());
        ClientWorldEvents.UNLOAD.register((client, world) -> controller.resetMacroState());

        LOGGER.info("Tiger Macro initialized. Default delay: {}ms", config.getDelayMs());
    }

    private static void onClientTick(MinecraftClient client) {
        if (client.screen != null || !client.isWindowActive()) {
            drainKeyPresses();
            controller.resetMacroState();
            return;
        }

        processGlobalToggle();
        processMacroToggle();
        processConfigOpen(client);
        controller.tick(client);
    }

    private static void processGlobalToggle() {
        while (TOGGLE_GLOBAL_KEY.wasPressed()) {
            controller.toggleGlobal();
        }
    }

    private static void processMacroToggle() {
        // A keybind collision is allowed by Minecraft's normal Controls UI.
        // Do not let one physical key produce two control actions inside this mod.
        if (TOGGLE_MACRO_KEY.getBoundKey().equals(TOGGLE_GLOBAL_KEY.getBoundKey())) {
            while (TOGGLE_MACRO_KEY.wasPressed()) {
                // Intentionally consume the collision without toggling twice.
            }
            return;
        }

        while (TOGGLE_MACRO_KEY.wasPressed()) {
            controller.toggleMacro();
        }
    }

    private static void processConfigOpen(MinecraftClient client) {
        if (OPEN_CONFIG_KEY.getBoundKey().equals(TOGGLE_MACRO_KEY.getBoundKey())
                || OPEN_CONFIG_KEY.getBoundKey().equals(TOGGLE_GLOBAL_KEY.getBoundKey())) {
            while (OPEN_CONFIG_KEY.wasPressed()) {
                // Collision is intentionally consumed rather than causing a second action path.
            }
            return;
        }

        while (OPEN_CONFIG_KEY.wasPressed()) {
            client.setScreen(new MacroConfigScreen(client, null));
        }
    }

    private static void drainKeyPresses() {
        while (TOGGLE_GLOBAL_KEY.wasPressed()) {
            // Discard queued gameplay toggles while a screen is open or focus is lost.
        }
        while (TOGGLE_MACRO_KEY.wasPressed()) {
            // Discard queued gameplay toggles while a screen is open or focus is lost.
        }
        while (OPEN_CONFIG_KEY.wasPressed()) {
            // Discard queued settings opens when returning to gameplay.
        }
    }

    public static MacroConfig getConfig() {
        return config;
    }

    public static MacroController getController() {
        return controller;
    }

    /** Reloads settings and resets macro activity so new timing starts cleanly. */
    public static void reloadConfiguration() {
        if (controller != null) {
            controller.resetMacroState();
        }
        config = MacroConfig.load();
        if (controller != null) {
            controller.setConfig(config);
        }
    }

    /** Invokes vanilla's normal item-use path through a tiny Mixin invoker. */
    public static void invokeVanillaItemUse(MinecraftClient client) {
        ((MinecraftClientInvokerMixin) client).tigerMacro$doItemUse();
    }
}
