package com.tigerfx.tigermacro;

import net.minecraft.client.Minecraft;
import net.minecraft.client.input.KeyEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * TigerMacro's original held-key pulse behavior, restored for Minecraft 26.3 SDL.
 *
 * Unlike KeyMapping.click, this dispatches a real KeyboardHandler.keyPress action.
 * That is what the original 1.21.11 MacroController did to repeat an existing
 * gameplay key while still letting the physical release end sustained use.
 */
public final class MacroController {
    private static final Logger LOG = LoggerFactory.getLogger("Tiger Macro");
    private static final ScheduledExecutorService TIMER =
            Executors.newSingleThreadScheduledExecutor(task -> {
                Thread thread = new Thread(task, "TigerMacro-Timer");
                thread.setDaemon(true);
                return thread;
            });
    private static final AtomicLong GENERATION = new AtomicLong();
    private static final AtomicBoolean PULSE_QUEUED = new AtomicBoolean();

    private static volatile boolean held;
    private static volatile long activeWindow;
    private static volatile int activeKey = -1;
    private static ScheduledFuture<?> scheduled;

    private MacroController() {}

    public static synchronized void reset() {
        held = false;
        activeKey = -1;
        GENERATION.incrementAndGet();
        PULSE_QUEUED.set(false);
        if (scheduled != null) {
            scheduled.cancel(false);
            scheduled = null;
        }
    }

    public static synchronized void setEnabled(boolean value) {
        MacroConfig.get().enabled = value;
        MacroConfig.save();
        reset();
    }

    public static synchronized boolean toggleEnabled() {
        setEnabled(!MacroConfig.get().enabled);
        return MacroConfig.get().enabled;
    }

    /**
     * Called on the client thread after player controls update each tick.
     * Changing to a filtered-out item immediately cancels the pulse task.
     */
    public static synchronized void tick(Minecraft mc) {
        MacroConfig cfg = MacroConfig.get();
        if (!cfg.enabled || mc.player == null || mc.level == null
                || mc.gui.screen() != null || TigerMacroClient.targetKey() == null
                || !TigerMacroClient.targetKey().isDown()
                || !ItemFilters.allowsHeldItem(mc)) {
            if (held) reset();
            return;
        }

        long window = mc.getWindow().getWindow();
        if (held && activeKey == cfg.targetKey && activeWindow == window) return;

        reset();
        held = true;
        activeWindow = window;
        activeKey = cfg.targetKey;
        long generation = GENERATION.incrementAndGet();
        int interval = MacroConfig.clamp(cfg.intervalMs, 1, 500);
        int delay = MacroConfig.clamp(cfg.repeatDelayMs, 0, 1000);
        int firstDelay = Math.max(1, delay == 0 ? interval : delay);

        scheduled = TIMER.scheduleAtFixedRate(
                () -> queuePulse(mc, generation), firstDelay, interval, TimeUnit.MILLISECONDS);
    }

    private static void queuePulse(Minecraft client, long generation) {
        if (!held || generation != GENERATION.get()
                || !PULSE_QUEUED.compareAndSet(false, true)) return;
        try {
            client.execute(() -> {
                try {
                    if (!held || generation != GENERATION.get()) return;
                    MacroConfig cfg = MacroConfig.get();
                    if (!cfg.enabled || client.player == null || client.level == null
                            || client.gui.screen() != null
                            || !TigerMacroClient.targetKey().isDown()
                            || !ItemFilters.allowsHeldItem(client)
                            || cfg.targetKey != activeKey) {
                        reset();
                        return;
                    }
                    // SDL 26.3 KeyEvent.key is a scancode. The keycode field
                    // represents a layout-dependent SDL keycode and is not
                    // required for Minecraft's keybind processing.
                    KeyEvent event = new KeyEvent(activeKey, 0, 0);
                    client.keyboardHandler.keyPress(activeWindow, 1, event);
                } catch (Throwable error) {
                    LOG.error("Tiger Macro stopped after a synthetic input error", error);
                    reset();
                } finally {
                    PULSE_QUEUED.set(false);
                }
            });
        } catch (Throwable error) {
            PULSE_QUEUED.set(false);
            LOG.error("Unable to schedule TigerMacro SDL input event", error);
            reset();
        }
    }
}
