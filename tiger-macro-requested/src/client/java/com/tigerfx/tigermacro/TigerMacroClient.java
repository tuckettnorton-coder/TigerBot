package com.tigerfx.tigermacro;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.KeyMapping;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import org.lwjgl.glfw.GLFW;

public final class TigerMacroClient implements ClientModInitializer {
    private static final KeyMapping.Category CATEGORY = KeyMapping.Category.register(
            Identifier.fromNamespaceAndPath("tigermacro", "controls")
    );

    private static UtilityKeyMapping openSettingsKey;
    private static UtilityKeyMapping toggleMacroKey;

    @Override
    public void onInitializeClient() {
        MacroConfig.load();

        openSettingsKey = (UtilityKeyMapping) KeyBindingHelper.registerKeyBinding(new UtilityKeyMapping(
                "key.tigermacro.open_settings",
                InputConstants.Type.KEYSYM,
                GLFW.GLFW_KEY_K,
                CATEGORY
        ));

        toggleMacroKey = (UtilityKeyMapping) KeyBindingHelper.registerKeyBinding(new UtilityKeyMapping(
                "key.tigermacro.toggle",
                InputConstants.Type.KEYSYM,
                GLFW.GLFW_KEY_F8,
                CATEGORY
        ));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (openSettingsKey.consumeClick()) {
                client.setScreen(new MacroConfigScreen(client.screen));
            }
            while (toggleMacroKey.consumeClick()) {
                boolean enabled = MacroController.toggleEnabled();
                if (client.player != null) {
                    client.player.displayClientMessage(
                            Component.literal("Tiger Macro " + (enabled ? "enabled" : "disabled")), true
                    );
                }
            }
        });
    }

    public static boolean isUtilityKey(int keyCode) {
        return (openSettingsKey != null && openSettingsKey.boundKeyCode() == keyCode)
                || (toggleMacroKey != null && toggleMacroKey.boundKeyCode() == keyCode);
    }

    private static final class UtilityKeyMapping extends KeyMapping {
        private UtilityKeyMapping(String name, InputConstants.Type type, int keyCode, KeyMapping.Category category) {
            super(name, type, keyCode, category);
        }

        private int boundKeyCode() {
            return this.key.getValue();
        }
    }
}
