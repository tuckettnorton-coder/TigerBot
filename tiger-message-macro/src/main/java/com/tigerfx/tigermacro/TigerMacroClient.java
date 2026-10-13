package com.tigerfx.tigermacro;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

public class TigerMacroClient implements ClientModInitializer {
    private static KeyBinding openPanel;
    private static final MacroConfig CONFIG = MacroConfig.load();
    private static final boolean[] KEY_WAS_DOWN = new boolean[GLFW.GLFW_KEY_LAST + 1];
    private static final boolean[] MOUSE_WAS_DOWN = new boolean[8];
    private static long nextAutoRepeatAt = 0L;

    private static final String LOCAL_TRIGGER_PACKET = "TIGERMSG:FIRE:0";
    private static final int LOCAL_TRIGGER_PORT_BASE = 20000;
    private static final int LOCAL_TRIGGER_PORT_RANGE = 20000;

    @Override
    public void onInitializeClient() {
        openPanel = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.tigermessage.open_panel",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_K,
                KeyBinding.Category.MISC
        ));

        startLocalTriggerReceiver();

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

    /**
     * Exposes a loopback-only UDP trigger for a second Minecraft instance.
     * The port is derived from this Java process PID, so the AHK script can
     * target one instance without activating it or injecting keyboard events.
     */
    private static void startLocalTriggerReceiver() {
        long processId = ProcessHandle.current().pid();
        int port = LOCAL_TRIGGER_PORT_BASE + (int) (processId % LOCAL_TRIGGER_PORT_RANGE);

        Thread receiver = new Thread(() -> {
            try (DatagramSocket socket = new DatagramSocket(null)) {
                socket.setReuseAddress(false);
                socket.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), port));
                byte[] data = new byte[128];
                System.out.println("[Tiger Message Macro] Local trigger ready on 127.0.0.1:" + port
                        + " (PID " + processId + ")");

                while (!Thread.currentThread().isInterrupted()) {
                    DatagramPacket packet = new DatagramPacket(data, data.length);
                    socket.receive(packet);
                    String command = new String(
                            packet.getData(), packet.getOffset(), packet.getLength(), StandardCharsets.UTF_8
                    ).trim();

                    if (LOCAL_TRIGGER_PACKET.equals(command)) {
                        MinecraftClient.getInstance().execute(() -> {
                            MinecraftClient client = MinecraftClient.getInstance();
                            if (client.player != null
                                    && client.player.networkHandler != null
                                    && CONFIG.actions != null
                                    && !CONFIG.actions.isEmpty()) {
                                // Remote trigger intentionally fires the first message slot.
                                sendMessage(CONFIG.actions.get(0).message);
                            }
                        });
                    }
                }
            } catch (IOException e) {
                System.err.println("[Tiger Message Macro] Local trigger receiver could not start on port "
                        + port + ": " + e.getMessage());
            }
        }, "TigerMessage-LocalTrigger");

        // Prioritize the tiny local trigger listener so the loopback signal is handled promptly.
        // Actual command sending still runs on Minecraft's main thread to avoid unsafe cross-thread game access.
        receiver.setDaemon(true);
        receiver.setPriority(Thread.MAX_PRIORITY);
        receiver.start();
    }

    static void sendMessage(String message) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (message == null || message.isBlank() || client.player == null
                || client.player.networkHandler == null) return;

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
