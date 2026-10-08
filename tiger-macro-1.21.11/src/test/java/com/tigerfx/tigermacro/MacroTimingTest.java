package com.tigerfx.tigermacro;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MacroTimingTest {
    @Test
    void enablingNeverFiresImmediately() {
        MacroTiming timing = new MacroTiming();
        timing.arm(1_000L, 100_000_000L);

        assertFalse(timing.isDue(1_000L));
        assertFalse(timing.isDue(1_099_999_999L));
        assertTrue(timing.isDue(1_100_000_000L));
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
}
