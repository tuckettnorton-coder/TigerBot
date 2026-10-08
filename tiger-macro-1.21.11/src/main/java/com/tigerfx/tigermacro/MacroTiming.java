package com.tigerfx.tigermacro;

/**
 * One monotonic timing gate owned by MacroController. It never runs callbacks and
 * never creates threads; it only records the next allowed action time.
 */
final class MacroTiming {
    private long nextActionTimeNanos;

    void arm(long nowNanos, long delayNanos) {
        nextActionTimeNanos = nowNanos + delayNanos;
    }

    void reset() {
        nextActionTimeNanos = 0L;
    }

    boolean isArmed() {
        return nextActionTimeNanos != 0L;
    }

    boolean isDue(long nowNanos) {
        return nextActionTimeNanos != 0L && nowNanos >= nextActionTimeNanos;
    }

    void scheduleNext(long nowNanos, long delayNanos) {
        // Always schedule from 'now', not from a stale deadline. This is deliberate
        // catch-up protection: one late tick produces at most one action.
        nextActionTimeNanos = nowNanos + delayNanos;
    }

    long getNextActionTimeNanos() {
        return nextActionTimeNanos;
    }
}
