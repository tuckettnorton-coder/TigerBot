package com.tigerfx.tigermacro.macro;

import com.tigerfx.tigermacro.config.MacroConfig;
import com.tigerfx.tigermacro.input.MacroKeybinds;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.client.util.Window;

import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import org.lwjgl.glfw.GLFW;

public final class MacroManager {
    private final MinecraftClient client;
    private final MacroConfig config;
    private final ScheduledThreadPoolExecutor scheduler;
    private final AtomicBoolean enabled = new AtomicBoolean(false);
    private final AtomicLong generation = new AtomicLong(0L);
    private final AtomicLong pendingGeneration = new AtomicLong(0L);
    private volatile int delayMs;
    private ScheduledFuture<?> activeSchedule;
    private InputUtil.Key activePressedKey;
    private boolean initialized;
    private boolean shutdown;

    public MacroManager(MinecraftClient client, MacroConfig config) {
        this.client = client;
        this.config = config;
        this.delayMs = MacroConfig.clampDelay(config.getDelayMs());
        this.scheduler = new ScheduledThreadPoolExecutor(1, runnable -> {
            Thread thread = new Thread(runnable, "TigerMacro-Timing");
            thread.setDaemon(true);
            return thread;
        });
        this.scheduler.setRemoveOnCancelPolicy(true);
        this.scheduler.setExecuteExistingDelayedTasksAfterShutdownPolicy(false);
        this.scheduler.setContinueExistingPeriodicTasksAfterShutdownPolicy(false);
    }

    public synchronized void initializeFromConfig() {
        if (initialized || shutdown) return;
        initialized = true;
        delayMs = MacroConfig.clampDelay(config.getDelayMs());
        enabled.set(config.isEnabled());
        if (enabled.get()) startScheduleLocked();
    }

    public synchronized void setEnabled(boolean value) {
        if (shutdown || enabled.get() == value) return;
        enabled.set(value);
        long token = generation.incrementAndGet();
        pendingGeneration.set(0L);
        cancelScheduleLocked();
        releaseActiveKey();
        config.setEnabled(value);
        config.save();
        if (value) startScheduleLocked(token);
    }

    public synchronized boolean isEnabled() { return enabled.get(); }
    public synchronized int getDelayMs() { return delayMs; }

    public synchronized void setDelayMs(int value) {
        if (shutdown) return;
        int sanitized = MacroConfig.clampDelay(value);
        if (delayMs == sanitized) {
            config.setDelayMs(sanitized);
            config.save();
            return;
        }
        delayMs = sanitized;
        config.setDelayMs(sanitized);
        config.save();

        if (enabled.get()) {
            long token = generation.incrementAndGet();
            pendingGeneration.set(0L);
            cancelScheduleLocked();
            releaseActiveKey();
            startScheduleLocked(token);
        }
    }

    private void startScheduleLocked() {
        long token = generation.incrementAndGet();
        startScheduleLocked(token);
    }

    private void startScheduleLocked(long token) {
        if (!enabled.get() || shutdown) return;
        long periodNanos = TimeUnit.MILLISECONDS.toNanos(MacroConfig.clampDelay(delayMs));
        activeSchedule = scheduler.scheduleAtFixedRate(() -> timingPulse(token), periodNanos, periodNanos, TimeUnit.NANOSECONDS);
    }

    private synchronized void cancelScheduleLocked() {
        if (activeSchedule != null) {
            activeSchedule.cancel(false);
            activeSchedule = null;
        }
    }

    private void timingPulse(long token) {
        if (!enabled.get() || shutdown || generation.get() != token) return;
        if (!pendingGeneration.compareAndSet(0L, token)) return;
        client.execute(() -> {
            if (!pendingGeneration.compareAndSet(token, 0L)) return;
            if (!enabled.get() || shutdown || generation.get() != token) return;
            if (!isUsableGameplayState()) {
                releaseActiveKey();
                return;
            }
            activateConfiguredKey();
        });
    }

    private boolean isUsableGameplayState() {
        if (client.level == null || client.currentScreen != null) return false;
        Window window = client.getWindow();
        try { return GLFW.glfwGetWindowAttrib(window.getHandle(), GLFW.GLFW_FOCUSED) == GLFW.GLFW_TRUE; }
        catch (Throwable ignored) { return true; }
    }

    private void activateConfiguredKey() {
        KeyBinding binding = MacroKeybinds.macroKey();
        InputUtil.Key key = KeyBindingHelper.getBoundKeyOf(binding);
        if (key == null || key.equals(InputUtil.UNKNOWN_KEY) || key.getCategory() != InputUtil.Type.KEYSYM) {
            releaseActiveKey();
            return;
        }
        if (activePressedKey != null && !activePressedKey.equals(key)) {
            KeyBinding.setKeyPressed(activePressedKey, false);
            activePressedKey = null;
        }
        KeyBinding.setKeyPressed(key, true);
        KeyBinding.onKeyPressed(key);
        activePressedKey = key;
    }

    private void releaseActiveKey() {
        if (activePressedKey != null) {
            KeyBinding.setKeyPressed(activePressedKey, false);
            activePressedKey = null;
        }
    }

    public synchronized void shutdown() {
        if (shutdown) return;
        shutdown = true;
        enabled.set(false);
        generation.incrementAndGet();
        pendingGeneration.set(0L);
        cancelScheduleLocked();
        releaseActiveKey();
        scheduler.shutdownNow();
        config.save();
    }
}