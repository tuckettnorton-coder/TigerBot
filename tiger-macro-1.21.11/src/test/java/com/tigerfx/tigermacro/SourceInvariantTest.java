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
