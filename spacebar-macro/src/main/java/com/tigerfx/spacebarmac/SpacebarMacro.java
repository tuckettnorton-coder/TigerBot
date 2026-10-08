package com.tigerfx.spacebarmac;

import com.tigerfx.spacebarmac.mixin.KeyboardInvoker;
import com.tigerfx.spacebarmac.mixin.MinecraftClientAccessor;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.Keyboard;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.input.KeyInput;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.util.Identifier;
import org.lwjgl.glfw.GLFW;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

public final class SpacebarMacro {
    private static final long INITIAL_DELAY_NANOS = 0L;
    private static final int MIN_DELAY_MS = 10;
    private static final int MAX_DELAY_MS = 500;

    public static final KeyBinding.Category CATEGORY =
            KeyBinding.Category.create(Identifier.of("spacebar_macro", "kb_repeat"));

    public static final KeyBinding TOGGLE_KEY = new KeyBinding(
            "key.spacebar_macro.toggle",
            InputUtil.Type.KEYSYM,
            GLFW.GLFW_KEY_F8,
            CATEGORY
    );

    public static final KeyBinding REPEAT_TARGET_KEY = new KeyBinding(
            "key.spacebar_macro.repeat_target",
            InputUtil.Type.KEYSYM,
            GLFW.GLFW_KEY_SPACE,
            CATEGORY
    );

    public static final KeyBinding OPEN_MENU_KEY = new KeyBinding(
            "key.spacebar_macro.open_menu",
            InputUtil.Type.KEYSYM,
            InputUtil.UNKNOWN_KEY.getCode(),
            CATEGORY
    );

    private static final ScheduledExecutorService SCHEDULER =
            Executors.newSingleThreadScheduledExecutor(runnable -> {
                Thread thread = new Thread(runnable, "Spacebar-Macro-Timer");
                thread.setDaemon(true);
                return thread;
            });

    private static volatile ScheduledFuture<?> repeatTask;
    private static volatile boolean repeatHeld;
    private static volatile int repeatKeyCode = GLFW.GLFW_KEY_SPACE;
    private static volatile int repeatScancode = 57;
    private static volatile MinecraftClient client;
    private static volatile boolean enabled = true;
    private static volatile int repeatDelayMs = 135;

    private static final ThreadLocal<Boolean> SYNTHETIC_REPEAT =
            ThreadLocal.withInitial(() -> false);

    private SpacebarMacro() {
    }

    public static void initialize() {
        client = MinecraftClient.getInstance();

        KeyBindingHelper.registerKeyBinding(TOGGLE_KEY);
        KeyBindingHelper.registerKeyBinding(REPEAT_TARGET_KEY);
        KeyBindingHelper.registerKeyBinding(OPEN_MENU_KEY);
    }

    public static boolean isEnabled() {
        return enabled;
    }

    public static int getRepeatDelayMs() {
        return repeatDelayMs;
    }

    public static void setRepeatDelayMs(int milliseconds) {
        repeatDelayMs = Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, milliseconds));

        if (repeatHeld && enabled) {
            scheduleRepeating();
        }
    }

    public static boolean isToggleKey(KeyInput input) {
        return TOGGLE_KEY.matchesKey(input);
    }

    public static boolean isTargetKey(KeyInput input) {
        return REPEAT_TARGET_KEY.matchesKey(input);
    }

    public static boolean isOpenMenuKey(KeyInput input) {
        return OPEN_MENU_KEY.matchesKey(input);
    }

    public static void handleControlKey(int action) {
        if (action == GLFW.GLFW_PRESS) {
            enabled = !enabled;
            if (!enabled) {
                stopRepeating();
            }
        }
    }

    public static void openMenu() {
        if (client != null) {
            client.setScreen(new SpacebarMacroScreen(client.currentScreen));
        }
    }

    public static void onPhysicalKey(int action, KeyInput input) {
        if (!enabled || !isTargetKey(input)) {
            return;
        }

        if (action == GLFW.GLFW_PRESS) {
            repeatHeld = true;
            repeatKeyCode = input.key();
            repeatScancode = input.scancode();
            scheduleRepeating();
        } else if (action == GLFW.GLFW_RELEASE) {
            stopRepeating();
        }
    }

    public static boolean isSyntheticRepeat() {
        return SYNTHETIC_REPEAT.get();
    }

    public static void resetForFocusLoss() {
        stopRepeating();
    }

    public static void stopRepeating() {
        repeatHeld = false;

        ScheduledFuture<?> task = repeatTask;
        repeatTask = null;
        if (task != null) {
            task.cancel(false);
        }
    }

    private static void scheduleRepeating() {
        ScheduledFuture<?> oldTask = repeatTask;
        if (oldTask != null) {
            oldTask.cancel(false);
        }

        repeatTask = SCHEDULER.scheduleAtFixedRate(
                SpacebarMacro::emitRepeat,
                INITIAL_DELAY_NANOS,
                TimeUnit.MILLISECONDS.toNanos(repeatDelayMs),
                TimeUnit.NANOSECONDS
        );
    }

    private static void emitRepeat() {
        MinecraftClient minecraft = client;
        if (minecraft == null || !enabled || !repeatHeld) {
            return;
        }

        if (!minecraft.isWindowFocused()) {
            resetForFocusLoss();
            return;
        }

        KeyInput input = new KeyInput(
                repeatKeyCode,
                repeatScancode,
                0
        );

        minecraft.execute(() -> {
            if (!enabled || !repeatHeld || !minecraft.isWindowFocused()) {
                return;
            }

            Keyboard keyboard =
                    ((MinecraftClientAccessor) minecraft).spacebarMacro$getKeyboard();
            KeyboardInvoker invoker = (KeyboardInvoker) (Object) keyboard;

            SYNTHETIC_REPEAT.set(true);
            try {
                invoker.spacebarMacro$invokeOnKey(
                        minecraft.getWindow().getHandle(),
                        GLFW.GLFW_REPEAT,
                        input
                );
            } finally {
                SYNTHETIC_REPEAT.set(false);
            }
        });
    }
}
