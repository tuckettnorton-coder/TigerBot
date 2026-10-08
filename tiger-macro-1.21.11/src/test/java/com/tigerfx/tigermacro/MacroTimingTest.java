package com.tigerfx.tigermacro;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MacroTimingTest {
    @Test
    void enablingNeverFiresImmediately() {
        MacroTiming timing = new MacroTiming();
        timing.arm(1_000L, 100_000_000L);

        assertFalse(timing.isDue(1_000L));
        assertFalse(timing.isDue(100_000_999L));
        assertTrue(timing.isDue(100_001_000L));
    }

    @Test
    void scheduleUsesNowAndDoesNotCatchUp() {
        MacroTiming timing = new MacroTiming();
        timing.arm(1_000L, 100L);

        long lateNow = 10_000L;
        assertTrue(timing.isDue(lateNow));
        timing.scheduleNext(lateNow, 100L);

        assertFalse(timing.isDue(lateNow + 99L));
        assertTrue(timing.isDue(lateNow + 100L));
    }

    @Test
    void resetStopsFutureActions() {
        MacroTiming timing = new MacroTiming();
        timing.arm(1_000L, 100L);
        timing.reset();

        assertFalse(timing.isDue(Long.MAX_VALUE));
        assertEquals(0L, timing.getNextActionTimeNanos());
    }

    @Test
    void delayIsClampedToTenThroughFiveHundred() {
        assertEquals(10, MacroConfig.clampDelay(-50));
        assertEquals(10, MacroConfig.clampDelay(10));
        assertEquals(250, MacroConfig.clampDelay(250));
        assertEquals(500, MacroConfig.clampDelay(500));
        assertEquals(500, MacroConfig.clampDelay(900));
    }
}
