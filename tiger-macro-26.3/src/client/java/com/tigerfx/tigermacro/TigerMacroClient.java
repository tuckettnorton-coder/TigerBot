package com.tigerfx.tigermacro;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;

public final class TigerMacroClient implements ClientModInitializer {
    private static final KeyMapping.Category CATEGORY = KeyMapping.Category.register(
        Identifier.fromNamespaceAndPath("tigermacro","controls"));
    private static KeyMapping openSettings;
    private static KeyMapping toggleMacro;
    private static KeyMapping target;

    @Override public void onInitializeClient() {
        MacroConfig.load();
        ItemFilters.load();
        openSettings = KeyMappingHelper.registerKeyMapping(new KeyMapping(
            "key.tigermacro.open_settings", InputConstants.Type.KEYBOARD, InputConstants.KEY_K, CATEGORY));
        toggleMacro = KeyMappingHelper.registerKeyMapping(new KeyMapping(
            "key.tigermacro.toggle", InputConstants.Type.KEYBOARD, InputConstants.KEY_F8, CATEGORY));
        target = KeyMappingHelper.registerKeyMapping(new KeyMapping(
            "key.tigermacro.target", InputConstants.Type.KEYBOARD, MacroConfig.get().targetKey, CATEGORY));
        ClientTickEvents.END_CLIENT_TICK.register(mc -> {
            while (openSettings.consumeClick()) {
                if (mc.gui.screen() == null || !(mc.gui.screen() instanceof MacroConfigScreen))
                    mc.gui.setScreen(new MacroConfigScreen(mc.gui.screen()));
            }
            while (toggleMacro.consumeClick()) {
                boolean enabled = MacroController.toggleEnabled();
                if (mc.player != null)
                    mc.player.sendSystemMessage(Component.literal("Tiger Macro " + (enabled ? "ENABLED" : "DISABLED") + " • " + (ItemFilters.isWhitelistMode() ? "Whitelist" : "Blacklist") + " mode"));
            }
            MacroController.tick(mc);
        });
    }
    public static KeyMapping targetKey() { return target; }
    public static boolean isUtilityKey(int key) {
        return key == InputConstants.KEY_K || key == InputConstants.KEY_F8;
    }
    public static void setTargetKey(int key) {
        if (isUtilityKey(key)) return;
        MacroConfig.get().targetKey = key;
        MacroConfig.save();
        target.setKey(InputConstants.Type.KEYBOARD.getOrCreate(key));
        KeyMapping.resetMapping();
        MacroController.reset();
    }
}
