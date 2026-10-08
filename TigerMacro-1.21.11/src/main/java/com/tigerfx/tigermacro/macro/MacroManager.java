package com.tigerfx.tigermacro.macro;

import com.tigerfx.tigermacro.config.MacroConfig;
import com.tigerfx.tigermacro.input.MacroKeybinds;
import net.minecraft.client.util.InputUtil;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import org.lwjgl.glfw.GLFW;

import java.awt.AWTException;
import java.awt.GraphicsEnvironment;
import java.awt.Robot;
import java.awt.event.KeyEvent;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

public final class MacroManager {
    private final MacroConfig config;
    private final ScheduledThreadPoolExecutor scheduler;
    private final AtomicBoolean enabled = new AtomicBoolean(false);
    private final AtomicBoolean clientInputAllowed = new AtomicBoolean(false);
    private final AtomicReference<InputUtil.Key> macroKey = new AtomicReference<>();
    private final AtomicLong generation = new AtomicLong(0L);

    private volatile int delayMs;
    private ScheduledFuture<?> activeSchedule;
    private boolean initialized;
    private boolean shutdown;
    private Robot robot;

    public MacroManager(net.minecraft.client.MinecraftClient client, MacroConfig config) {
        this.config = config;
        this.delayMs = MacroConfig.clampDelay(config.getDelayMs());
        this.robot = createRobot();

        this.scheduler = new ScheduledThreadPoolExecutor(1, runnable -> {
            Thread thread = new Thread(runnable, "TigerMacro-Timing");
            thread.setDaemon(true);
            return thread;
        });
        this.scheduler.setRemoveOnCancelPolicy(true);
        this.scheduler.setExecuteExistingDelayedTasksAfterShutdownPolicy(false);
        this.scheduler.setContinueExistingPeriodicTasksAfterShutdownPolicy(false);
    }

    private static Robot createRobot() {
        if (GraphicsEnvironment.isHeadless()) {
            return null;
        }
        try {
            Robot robot = new Robot();
            robot.setAutoDelay(0);
            robot.setAutoWaitForIdle(false);
            return robot;
        } catch (AWTException | SecurityException ignored) {
            return null;
        }
    }

    public synchronized void initializeFromConfig() {
        if (initialized || shutdown) return;
        initialized = true;
        delayMs = MacroConfig.clampDelay(config.getDelayMs());
        enabled.set(config.isEnabled());
        if (enabled.get()) startScheduleLocked();
    }

    public void setMacroKey(InputUtil.Key key) {
        macroKey.set(key);
    }

    public void setClientInputAllowed(boolean allowed) {
        clientInputAllowed.set(allowed);
    }

    public synchronized void setEnabled(boolean value) {
        if (shutdown || enabled.get() == value) return;

        enabled.set(value);
        long token = generation.incrementAndGet();
        cancelScheduleLocked();

        config.setEnabled(value);
        config.save();

        if (value) {
            startScheduleLocked(token);
        }
    }

    public boolean isEnabled() {
        return enabled.get();
    }

    public synchronized int getDelayMs() {
        return delayMs;
    }

    public synchronized void setDelayMs(int value) {
        if (shutdown) return;

        int sanitized = MacroConfig.clampDelay(value);
        delayMs = sanitized;
        config.setDelayMs(sanitized);
        config.save();

        if (enabled.get()) {
            long token = generation.incrementAndGet();
            cancelScheduleLocked();
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
        activeSchedule = scheduler.scheduleAtFixedRate(
                () -> timingPulse(token),
                periodNanos,
                periodNanos,
                TimeUnit.NANOSECONDS
        );
    }

    private synchronized void cancelScheduleLocked() {
        if (activeSchedule != null) {
            activeSchedule.cancel(false);
            activeSchedule = null;
        }
    }

    private void timingPulse(long token) {
        if (!enabled.get() || shutdown || generation.get() != token || !clientInputAllowed.get()) {
            return;
        }

        InputUtil.Key key = macroKey.get();
        int awtCode = toAwtKeyCode(key);
        if (robot == null || awtCode == KeyEvent.VK_UNDEFINED || key == null) {
            return;
        }

        InputUtil.Key toggleKey = KeyBindingHelper.getBoundKeyOf(MacroKeybinds.macroToggle());
        InputUtil.Key menuKey = KeyBindingHelper.getBoundKeyOf(MacroKeybinds.openMacroMenu());

        if (key.equals(toggleKey) || key.equals(menuKey)) {
            return;
        }

        if (!enabled.get() || generation.get() != token || !clientInputAllowed.get()) {
            return;
        }

        try {
            robot.keyPress(awtCode);
            robot.keyRelease(awtCode);
        } catch (IllegalArgumentException | IllegalStateException ignored) {
        }
    }

    private static int toAwtKeyCode(InputUtil.Key key) {
        if (key == null || key.equals(InputUtil.UNKNOWN_KEY) || key.getCategory() != InputUtil.Type.KEYSYM) {
            return KeyEvent.VK_UNDEFINED;
        }

        return switch (key.getCode()) {
            case GLFW.GLFW_KEY_SPACE -> KeyEvent.VK_SPACE;
            case GLFW.GLFW_KEY_APOSTROPHE -> KeyEvent.VK_QUOTE;
            case GLFW.GLFW_KEY_COMMA -> KeyEvent.VK_COMMA;
            case GLFW.GLFW_KEY_MINUS -> KeyEvent.VK_MINUS;
            case GLFW.GLFW_KEY_PERIOD -> KeyEvent.VK_PERIOD;
            case GLFW.GLFW_KEY_SLASH -> KeyEvent.VK_SLASH;
            case GLFW.GLFW_KEY_SEMICOLON -> KeyEvent.VK_SEMICOLON;
            case GLFW.GLFW_KEY_EQUAL -> KeyEvent.VK_EQUALS;
            case GLFW.GLFW_KEY_LEFT_BRACKET -> KeyEvent.VK_OPEN_BRACKET;
            case GLFW.GLFW_KEY_BACKSLASH -> KeyEvent.VK_BACK_SLASH;
            case GLFW.GLFW_KEY_RIGHT_BRACKET -> KeyEvent.VK_CLOSE_BRACKET;
            case GLFW.GLFW_KEY_GRAVE_ACCENT -> KeyEvent.VK_BACK_QUOTE;
            case GLFW.GLFW_KEY_ESCAPE -> KeyEvent.VK_ESCAPE;
            case GLFW.GLFW_KEY_ENTER -> KeyEvent.VK_ENTER;
            case GLFW.GLFW_KEY_TAB -> KeyEvent.VK_TAB;
            case GLFW.GLFW_KEY_BACKSPACE -> KeyEvent.VK_BACK_SPACE;
            case GLFW.GLFW_KEY_INSERT -> KeyEvent.VK_INSERT;
            case GLFW.GLFW_KEY_DELETE -> KeyEvent.VK_DELETE;
            case GLFW.GLFW_KEY_RIGHT -> KeyEvent.VK_RIGHT;
            case GLFW.GLFW_KEY_LEFT -> KeyEvent.VK_LEFT;
            case GLFW.GLFW_KEY_DOWN -> KeyEvent.VK_DOWN;
            case GLFW.GLFW_KEY_UP -> KeyEvent.VK_UP;
            case GLFW.GLFW_KEY_PAGE_UP -> KeyEvent.VK_PAGE_UP;
            case GLFW.GLFW_KEY_PAGE_DOWN -> KeyEvent.VK_PAGE_DOWN;
            case GLFW.GLFW_KEY_HOME -> KeyEvent.VK_HOME;
            case GLFW.GLFW_KEY_END -> KeyEvent.VK_END;
            case GLFW.GLFW_KEY_CAPS_LOCK -> KeyEvent.VK_CAPS_LOCK;
            case GLFW.GLFW_KEY_SCROLL_LOCK -> KeyEvent.VK_SCROLL_LOCK;
            case GLFW.GLFW_KEY_NUM_LOCK -> KeyEvent.VK_NUM_LOCK;
            case GLFW.GLFW_KEY_PRINT_SCREEN -> KeyEvent.VK_PRINTSCREEN;
            case GLFW.GLFW_KEY_PAUSE -> KeyEvent.VK_PAUSE;
            case GLFW.GLFW_KEY_MENU -> KeyEvent.VK_CONTEXT_MENU;
            case GLFW.GLFW_KEY_LEFT_SHIFT, GLFW.GLFW_KEY_RIGHT_SHIFT -> KeyEvent.VK_SHIFT;
            case GLFW.GLFW_KEY_LEFT_CONTROL, GLFW.GLFW_KEY_RIGHT_CONTROL -> KeyEvent.VK_CONTROL;
            case GLFW.GLFW_KEY_LEFT_ALT, GLFW.GLFW_KEY_RIGHT_ALT -> KeyEvent.VK_ALT;
            case GLFW.GLFW_KEY_LEFT_SUPER, GLFW.GLFW_KEY_RIGHT_SUPER -> KeyEvent.VK_WINDOWS;

            case GLFW.GLFW_KEY_0 -> KeyEvent.VK_0;
            case GLFW.GLFW_KEY_1 -> KeyEvent.VK_1;
            case GLFW.GLFW_KEY_2 -> KeyEvent.VK_2;
            case GLFW.GLFW_KEY_3 -> KeyEvent.VK_3;
            case GLFW.GLFW_KEY_4 -> KeyEvent.VK_4;
            case GLFW.GLFW_KEY_5 -> KeyEvent.VK_5;
            case GLFW.GLFW_KEY_6 -> KeyEvent.VK_6;
            case GLFW.GLFW_KEY_7 -> KeyEvent.VK_7;
            case GLFW.GLFW_KEY_8 -> KeyEvent.VK_8;
            case GLFW.GLFW_KEY_9 -> KeyEvent.VK_9;

            case GLFW.GLFW_KEY_A -> KeyEvent.VK_A;
            case GLFW.GLFW_KEY_B -> KeyEvent.VK_B;
            case GLFW.GLFW_KEY_C -> KeyEvent.VK_C;
            case GLFW.GLFW_KEY_D -> KeyEvent.VK_D;
            case GLFW.GLFW_KEY_E -> KeyEvent.VK_E;
            case GLFW.GLFW_KEY_F -> KeyEvent.VK_F;
            case GLFW.GLFW_KEY_G -> KeyEvent.VK_G;
            case GLFW.GLFW_KEY_H -> KeyEvent.VK_H;
            case GLFW.GLFW_KEY_I -> KeyEvent.VK_I;
            case GLFW.GLFW_KEY_J -> KeyEvent.VK_J;
            case GLFW.GLFW_KEY_K -> KeyEvent.VK_K;
            case GLFW.GLFW_KEY_L -> KeyEvent.VK_L;
            case GLFW.GLFW_KEY_M -> KeyEvent.VK_M;
            case GLFW.GLFW_KEY_N -> KeyEvent.VK_N;
            case GLFW.GLFW_KEY_O -> KeyEvent.VK_O;
            case GLFW.GLFW_KEY_P -> KeyEvent.VK_P;
            case GLFW.GLFW_KEY_Q -> KeyEvent.VK_Q;
            case GLFW.GLFW_KEY_R -> KeyEvent.VK_R;
            case GLFW.GLFW_KEY_S -> KeyEvent.VK_S;
            case GLFW.GLFW_KEY_T -> KeyEvent.VK_T;
            case GLFW.GLFW_KEY_U -> KeyEvent.VK_U;
            case GLFW.GLFW_KEY_V -> KeyEvent.VK_V;
            case GLFW.GLFW_KEY_W -> KeyEvent.VK_W;
            case GLFW.GLFW_KEY_X -> KeyEvent.VK_X;
            case GLFW.GLFW_KEY_Y -> KeyEvent.VK_Y;
            case GLFW.GLFW_KEY_Z -> KeyEvent.VK_Z;

            case GLFW.GLFW_KEY_F1 -> KeyEvent.VK_F1;
            case GLFW.GLFW_KEY_F2 -> KeyEvent.VK_F2;
            case GLFW.GLFW_KEY_F3 -> KeyEvent.VK_F3;
            case GLFW.GLFW_KEY_F4 -> KeyEvent.VK_F4;
            case GLFW.GLFW_KEY_F5 -> KeyEvent.VK_F5;
            case GLFW.GLFW_KEY_F6 -> KeyEvent.VK_F6;
            case GLFW.GLFW_KEY_F7 -> KeyEvent.VK_F7;
            case GLFW.GLFW_KEY_F8 -> KeyEvent.VK_F8;
            case GLFW.GLFW_KEY_F9 -> KeyEvent.VK_F9;
            case GLFW.GLFW_KEY_F10 -> KeyEvent.VK_F10;
            case GLFW.GLFW_KEY_F11 -> KeyEvent.VK_F11;
            case GLFW.GLFW_KEY_F12 -> KeyEvent.VK_F12;
            case GLFW.GLFW_KEY_F13 -> KeyEvent.VK_F13;
            case GLFW.GLFW_KEY_F14 -> KeyEvent.VK_F14;
            case GLFW.GLFW_KEY_F15 -> KeyEvent.VK_F15;
            case GLFW.GLFW_KEY_F16 -> KeyEvent.VK_F16;
            case GLFW.GLFW_KEY_F17 -> KeyEvent.VK_F17;
            case GLFW.GLFW_KEY_F18 -> KeyEvent.VK_F18;
            case GLFW.GLFW_KEY_F19 -> KeyEvent.VK_F19;
            case GLFW.GLFW_KEY_F20 -> KeyEvent.VK_F20;
            case GLFW.GLFW_KEY_F21 -> KeyEvent.VK_F21;
            case GLFW.GLFW_KEY_F22 -> KeyEvent.VK_F22;
            case GLFW.GLFW_KEY_F23 -> KeyEvent.VK_F23;
            case GLFW.GLFW_KEY_F24 -> KeyEvent.VK_F24;

            case GLFW.GLFW_KEY_KP_0 -> KeyEvent.VK_NUMPAD0;
            case GLFW.GLFW_KEY_KP_1 -> KeyEvent.VK_NUMPAD1;
            case GLFW.GLFW_KEY_KP_2 -> KeyEvent.VK_NUMPAD2;
            case GLFW.GLFW_KEY_KP_3 -> KeyEvent.VK_NUMPAD3;
            case GLFW.GLFW_KEY_KP_4 -> KeyEvent.VK_NUMPAD4;
            case GLFW.GLFW_KEY_KP_5 -> KeyEvent.VK_NUMPAD5;
            case GLFW.GLFW_KEY_KP_6 -> KeyEvent.VK_NUMPAD6;
            case GLFW.GLFW_KEY_KP_7 -> KeyEvent.VK_NUMPAD7;
            case GLFW.GLFW_KEY_KP_8 -> KeyEvent.VK_NUMPAD8;
            case GLFW.GLFW_KEY_KP_9 -> KeyEvent.VK_NUMPAD9;
            case GLFW.GLFW_KEY_KP_DECIMAL -> KeyEvent.VK_DECIMAL;
            case GLFW.GLFW_KEY_KP_DIVIDE -> KeyEvent.VK_DIVIDE;
            case GLFW.GLFW_KEY_KP_MULTIPLY -> KeyEvent.VK_MULTIPLY;
            case GLFW.GLFW_KEY_KP_SUBTRACT -> KeyEvent.VK_SUBTRACT;
            case GLFW.GLFW_KEY_KP_ADD -> KeyEvent.VK_ADD;
            case GLFW.GLFW_KEY_KP_ENTER -> KeyEvent.VK_ENTER;
            default -> KeyEvent.VK_UNDEFINED;
        };
    }

    public synchronized void shutdown() {
        if (shutdown) return;
        shutdown = true;
        enabled.set(false);
        generation.incrementAndGet();
        cancelScheduleLocked();
        scheduler.shutdownNow();
        robot = null;
        config.save();
    }
}
