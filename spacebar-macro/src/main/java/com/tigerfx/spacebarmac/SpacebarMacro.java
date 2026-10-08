package com.tigerfx.spacebarmac;

import com.tigerfx.spacebarmac.mixin.GameOptionsAccessor;
import com.tigerfx.spacebarmac.mixin.KeyboardInvoker;
import com.tigerfx.spacebarmac.mixin.MinecraftClientAccessor;
import net.minecraft.client.Keyboard;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.input.KeyInput;
import net.minecraft.client.option.GameOptions;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.util.Identifier;
import org.lwjgl.glfw.GLFW;

import java.util.Arrays;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

public final class SpacebarMacro {
    private static final long INITIAL_DELAY_NANOS = 0L;
    private static final long REPEAT_INTERVAL_NANOS = 135_000_000L;

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

    private static final ScheduledExecutorService SCHEDULER =
            Executors.newSingleThreadScheduledExecutor(runnable -> {
                Thread thread = new Thread(runnable, "Spacebar-Macro-Timer");
                thread.setDaemon(true);
                return thread;
            });

    private static volatile ScheduledFuture<?> repeatTask;
    private static volatile boolean repeatHeld;
    private static volatile int repeatScancode = 57;
    private static volatile MinecraftClient client;
    private static volatile boolean enabled = true;

    private static final ThreadLocal<Boolean> SYNTHETIC_REPEAT =
            ThreadLocal.withInitial(() -> false);

    private SpacebarMacro() {
    }

    public static void initialize() {
        client = MinecraftClient.getInstance();
        GameOptions options = client.options;

        if (Arrays.stream(options.allKeys).noneMatch(key -> key == TOGGLE_KEY)) {
            GameOptionsAccessor accessor = (GameOptionsAccessor) (Object) options;
            KeyBinding[] current = options.allKeys;
            KeyBinding[] updated = Arrays.copyOf(current, current.length + 2);
            updated[current.length] = TOGGLE_KEY;
            updated[current.length + 1] = REPEAT_TARGET_KEY;
            accessor.spacebarMacro$setAllKeys(updated);
        }
    }

    public static boolean isEnabled() {
        return enabled;
    }

    public static boolean isTargetKey(KeyInput input) {
        return REPEAT_TARGET_KEY.matchesKey(input);
    }

    public static void handleControlKey(int action, KeyInput input) {
        if (!TOGGLE_KEY.matchesKey(input)) {
            return;
        }

        if (action == GLFW.GLFW_PRESS) {
            enabled = !enabled;
            if (!enabled) {
                stopRepeating();
            }
        }
    }

    public static void onPhysicalKey(int action, KeyInput input) {
        if (!isTargetKey(input)) {
            return;
        }

        if (action == GLFW.GLFW_PRESS) {
            repeatHeld = true;
            repeatScancode = input.scancode();

            ScheduledFuture<?> oldTask = repeatTask;
            if (oldTask != null) {
                oldTask.cancel(false);
            }

            repeatTask = SCHEDULER.scheduleAtFixedRate(
                    SpacebarMacro::emitRepeat,
                    INITIAL_DELAY_NANOS,
                    REPEAT_INTERVAL_NANOS,
                    TimeUnit.NANOSECONDS
            );
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
                REPEAT_TARGET_KEY.getBoundKey().getCode(),
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
