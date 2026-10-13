package com.tigerfx.tigermacro;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

public class TigerMacroClient implements ClientModInitializer {
    private static KeyBinding openPanel;
    private static final MacroConfig CONFIG = MacroConfig.load();
    private static final boolean[] KEY_WAS_DOWN = new boolean[GLFW.GLFW_KEY_LAST + 1];
    private static final boolean[] MOUSE_WAS_DOWN = new boolean[8];
    private static long nextAutoRepeatAt = 0L;

    @Override
    public void onInitializeClient() {
        openPanel = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.tigermessage.open_panel",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_K,
                KeyBinding.Category.MISC
        ));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (openPanel.wasPressed()) {
                client.setScreen(new MacroPanelScreen());
            }

            if (client.player == null || client.getWindow() == null) return;

            long now = System.currentTimeMillis();
            if (CONFIG.autoRepeatEnabled && now >= nextAutoRepeatAt) {
                if (client.currentScreen == null) sendMessage(CONFIG.autoRepeatMessage);
                nextAutoRepeatAt = now + MacroConfig.clamp(CONFIG.autoRepeatIntervalMs, 250, 60000);
            }

            if (client.currentScreen != null) return;

            long window = client.getWindow().getHandle();
            for (MacroConfig.Action action : CONFIG.actions) {
                boolean down = false;

                if ("key".equals(action.triggerType)
                        && action.triggerCode > 0
                        && action.triggerCode <= GLFW.GLFW_KEY_LAST) {
                    down = GLFW.glfwGetKey(window, action.triggerCode) == GLFW.GLFW_PRESS;
                    if (down && !KEY_WAS_DOWN[action.triggerCode]) sendMessage(action.message);
                    KEY_WAS_DOWN[action.triggerCode] = down;
                } else if ("mouse".equals(action.triggerType)
                        && action.triggerCode >= 0
                        && action.triggerCode < MOUSE_WAS_DOWN.length) {
                    down = GLFW.glfwGetMouseButton(window, action.triggerCode) == GLFW.GLFW_PRESS;
                    if (down && !MOUSE_WAS_DOWN[action.triggerCode]) sendMessage(action.message);
                    MOUSE_WAS_DOWN[action.triggerCode] = down;
                }
            }
        });
    }

    static void sendMessage(String message) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (message == null || message.isBlank() || client.player == null) return;

        String text = message.trim();
        if (text.startsWith("/")) {
            String command = text.substring(1).trim();
            if (!command.isEmpty()) client.player.networkHandler.sendChatCommand(command);
        } else {
            client.player.networkHandler.sendChatMessage(text);
        }
    }

    static MacroConfig config() {
        return CONFIG;
    }

    static void save() {
        CONFIG.save();
    }
}
