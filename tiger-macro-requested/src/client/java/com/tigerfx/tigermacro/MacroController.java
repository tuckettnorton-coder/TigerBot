package com.tigerfx.tigermacro;

import com.tigerfx.tigermacro.mixin.KeyboardHandlerInvoker;
import net.minecraft.client.Minecraft;
import net.minecraft.client.KeyboardHandler;
import net.minecraft.client.input.KeyEvent;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Tracks the physical hold and emits repeated key-down events on the client thread.
 * It deliberately does not synthesize key-up events for repeat pulses: only the real
 * physical release should end a held action such as eating or blocking with a shield.
 */
public final class MacroController {
    private static final Logger LOGGER = LoggerFactory.getLogger("Tiger Macro");
    // Minecraft processes gameplay input on client ticks; never emit multiple macro pulses in one tick.
    private static final int MIN_SCHEDULER_INTERVAL_MS = 25;
    private static final ScheduledExecutorService TIMER = Executors.newSingleThreadScheduledExecutor(task -> {
        Thread thread = new Thread(task, "TigerMacro-Timer");
        thread.setDaemon(true);
        return thread;
    });
    private static final ThreadLocal<Boolean> SYNTHETIC_EVENT = ThreadLocal.withInitial(() -> false);
    private static final AtomicLong GENERATIONS = new AtomicLong();
    private static final AtomicLong QUEUED_GENERATION = new AtomicLong(-1L);

    private static volatile boolean physicallyHeld;
    private static volatile int heldKey = -1;
    private static volatile int heldScanCode;
    private static volatile int heldModifiers;
    private static volatile long heldWindow;
    private static volatile int heldStartPlayerTick;
    private static volatile int lastPulsePlayerTick = Integer.MIN_VALUE;
    private static volatile long lastPulseNanos;
    private static volatile boolean hasSentSyntheticPulse;
    private static volatile long activeGeneration = -1L;
    private static ScheduledFuture<?> repeatingTask;

    private MacroController() {
    }

    public static boolean isSyntheticEvent() {
        return SYNTHETIC_EVENT.get();
    }

    public static boolean shouldSuppressNativeRepeat(int key, int action) {
        if (action != GLFW.GLFW_REPEAT) {
            return false;
        }
        MacroConfig config = MacroConfig.get();
        Minecraft client = Minecraft.getInstance();
        return config.enabled
                && key == config.targetKey
                && physicallyHeld
                && client.player != null
                && client.screen == null;
    }

    public static void onNativeKeyEvent(long window, int key, int scanCode, int action, int modifiers) {
        if (isSyntheticEvent()) {
            return;
        }

        MacroConfig config = MacroConfig.get();
        if (key != config.targetKey) {
            return;
        }

        Minecraft client = Minecraft.getInstance();
        if (action == GLFW.GLFW_PRESS) {
            if (config.enabled && key >= 0 && client.player != null && client.screen == null) {
                startRepeating(window, key, scanCode, modifiers);
            } else {
                stopRepeating();
            }
        } else if (action == GLFW.GLFW_RELEASE) {
            stopRepeating();
        }
    }

    public static synchronized boolean toggleEnabled() {
        MacroConfig config = MacroConfig.get();
        config.enabled = !config.enabled;
        MacroConfig.save();
        if (!config.enabled) {
            stopRepeating();
        }
        return config.enabled;
    }

    public static synchronized void setEnabled(boolean enabled) {
        MacroConfig.get().enabled = enabled;
        MacroConfig.save();
        if (!enabled) {
            stopRepeating();
        }
    }

    /** Called when the delay, interval, or target-key settings change. */
    public static synchronized void configChanged() {
        MacroConfig config = MacroConfig.get();
        if (!config.enabled || !physicallyHeld || heldKey != config.targetKey) {
            stopRepeating();
            return;
        }
        scheduleRepeats();
    }

    private static synchronized void startRepeating(long window, int key, int scanCode, int modifiers) {
        stopRepeating();
        physicallyHeld = true;
        heldKey = key;
        heldScanCode = scanCode;
        heldModifiers = modifiers;
        heldWindow = window;
        Minecraft client = Minecraft.getInstance();
        heldStartPlayerTick = client.player != null ? client.player.tickCount : Integer.MIN_VALUE;
        lastPulsePlayerTick = heldStartPlayerTick;
        lastPulseNanos = System.nanoTime();
        hasSentSyntheticPulse = false;
        activeGeneration = GENERATIONS.incrementAndGet();
        scheduleRepeats();
    }

    private static synchronized void scheduleRepeats() {
        if (repeatingTask != null) {
            repeatingTask.cancel(false);
            repeatingTask = null;
        }
        if (!physicallyHeld || !MacroConfig.get().enabled || heldKey < 0) {
            return;
        }

        MacroConfig config = MacroConfig.get();
        long generation = activeGeneration;
        int delay = MacroConfig.clamp(config.repeatDelayMs, 0, 1000);

        // Check twice per normal client tick. The player-tick guard limits actual pulses to one per tick,
        // while the pulse-time check below preserves the configured repeat interval without tick-boundary drift.
        repeatingTask = TIMER.scheduleAtFixedRate(
                () -> queuePulse(generation),
                Math.max(1, delay),
                MIN_SCHEDULER_INTERVAL_MS,
                TimeUnit.MILLISECONDS
        );
    }

    private static void queuePulse(long generation) {
        if (generation != activeGeneration || !physicallyHeld) {
            return;
        }
        if (!QUEUED_GENERATION.compareAndSet(-1L, generation)) {
            return;
        }

        try {
            Minecraft.getInstance().execute(() -> {
                try {
                    if (!isStillValid(generation)) {
                        if (generation == activeGeneration) {
                            stopRepeating();
                        }
                        return;
                    }

                    Minecraft client = Minecraft.getInstance();
                    int playerTick = client.player.tickCount;
                    // Let Minecraft consume the original physical press first, then allow at most
                    // one synthetic press during each subsequent player tick.
                    if (playerTick <= heldStartPlayerTick || playerTick == lastPulsePlayerTick) {
                        return;
                    }
                    int configuredInterval = MacroConfig.clamp(MacroConfig.get().intervalMs, 1, 500);
                    long now = System.nanoTime();
                    if (hasSentSyntheticPulse
                            && now - lastPulseNanos < TimeUnit.MILLISECONDS.toNanos(configuredInterval)) {
                        return;
                    }

                    KeyboardHandler keyboard = client.keyboardHandler;
                    KeyboardHandlerInvoker invoker = (KeyboardHandlerInvoker) keyboard;
                    SYNTHETIC_EVENT.set(true);
                    try {
                        KeyEvent event = new KeyEvent(heldKey, heldScanCode, heldModifiers);

                        // Windows-style autorepeat sends repeated key-downs, not down/up pairs.
                        // Releasing here caused use-item actions to flicker off between pulses.
                        invoker.tigerMacro$invokeKeyPress(heldWindow, GLFW.GLFW_PRESS, event);
                        lastPulsePlayerTick = playerTick;
                        lastPulseNanos = System.nanoTime();
                        hasSentSyntheticPulse = true;
                    } finally {
                        SYNTHETIC_EVENT.remove();
                    }
                } catch (Throwable t) {
                    LOGGER.error("Tiger Macro stopped after an input error.", t);
                    stopRepeating();
                } finally {
                    QUEUED_GENERATION.compareAndSet(generation, -1L);
                }
            });
        } catch (Throwable t) {
            QUEUED_GENERATION.compareAndSet(generation, -1L);
            LOGGER.error("Could not queue a Tiger Macro input event.", t);
            stopRepeating();
        }
    }

    private static boolean isStillValid(long generation) {
        if (generation != activeGeneration || !physicallyHeld) {
            return false;
        }
        MacroConfig config = MacroConfig.get();
        Minecraft client = Minecraft.getInstance();
        if (!config.enabled || heldKey != config.targetKey || client.player == null || client.screen != null) {
            return false;
        }
        if (GLFW.glfwGetCurrentContext() != heldWindow) {
            return false;
        }
        return GLFW.glfwGetKey(heldWindow, heldKey) == GLFW.GLFW_PRESS;
    }

    private static synchronized void stopRepeating() {
        physicallyHeld = false;
        heldKey = -1;
        activeGeneration = GENERATIONS.incrementAndGet();
        if (repeatingTask != null) {
            repeatingTask.cancel(false);
            repeatingTask = null;
        }
    }
}
