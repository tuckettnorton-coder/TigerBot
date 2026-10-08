package com.tigerfx.tigermacro;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class SourceInvariantTest {
    @Test
    void macroControllerContainsNoThreadSleepOrTimerScheduler() throws Exception {
        String code = Files.readString(Path.of(
                "src/main/java/com/tigerfx/tigermacro/MacroController.java"
        ));
        assertFalse(code.contains("Thread.sleep"));
        assertFalse(code.contains("new Timer"));
        assertFalse(code.contains("ScheduledExecutorService"));
        assertFalse(code.contains("ExecutorService"));
        assertFalse(code.contains("while (timing.isDue"));
        assertEquals(2, count(code, "performMacroAction("));
    }

    @Test
    void tickContainsSingleActionGate() throws Exception {
        String code = Files.readString(Path.of(
                "src/main/java/com/tigerfx/tigermacro/MacroController.java"
        ));
        assertEquals(1, count(code, "if (timing.isDue(now))"));
        assertTrue(code.contains("timing.scheduleNext(now, config.getDelayNanos())"));
        assertTrue(code.contains("System.nanoTime()"));
        assertTrue(code.contains("KeyBinding.onKeyPressed(targetKey)"));
        assertTrue(code.contains("MacroInputGuard.beginSyntheticPress()"));
        assertTrue(code.contains("KeyBinding.updatePressedStates()"));
        assertTrue(code.contains("setMacroEnabled"));
        assertTrue(code.contains("TigerMacroClient.ENABLE_DISABLE_KEY"));
        assertFalse(code.contains("TOGGLE_MACRO_KEY"));
        assertFalse(code.contains("doItemUse"));
    }

    @Test
    void inputMixinBlocksPhysicalStateWhileMacroIsActive() throws Exception {
        String code = Files.readString(Path.of(
                "src/main/java/com/tigerfx/tigermacro/mixin/KeyBindingInputMixin.java"
        ));
        assertTrue(code.contains("method = \"setPressed\""));
        assertTrue(code.contains("method = \"onKeyPressed\""));
        assertTrue(code.contains("shouldSuppressPhysicalKey(boundKey)"));
    }

    @Test
    void onlyThreeUserControlsRemain() throws Exception {
        String code = Files.readString(Path.of(
                "src/main/java/com/tigerfx/tigermacro/MacroKeybinds.java"
        ));
        assertTrue(code.contains("ENABLE_DISABLE"));
        assertTrue(code.contains("MECHANIZED"));
        assertTrue(code.contains("SETTINGS"));
        assertFalse(code.contains("PLACEMENT"));
        assertFalse(code.contains("TOGGLE"));
    }

    @Test
    void syntheticPressIsClickOnlyAndDoesNotSetHeldState() throws Exception {
        String code = Files.readString(Path.of(
                "src/main/java/com/tigerfx/tigermacro/mixin/KeyBindingInputMixin.java"
        ));
        assertTrue(code.contains("this.timesPressed++"));
        assertTrue(code.contains("Do not run Minecraft's normal implementation a second time."));
        assertTrue(code.contains("MacroInputGuard.isSyntheticPress()"));
        assertFalse(code.contains("setPressed(true)"));
    }

    private static int count(String source, String token) {
        int count = 0;
        int index = 0;
        while ((index = source.indexOf(token, index)) >= 0) {
            count++;
            index += token.length();
        }
        return count;
    }
}
