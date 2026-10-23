package com.tigerfx.spacebarmac;

import net.fabricmc.api.ClientModInitializer;

public final class SpacebarMacroClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        SpacebarMacro.initialize();
    }
}
