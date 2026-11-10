package net.tigerfx.tigerauction;

import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.message.v1.ClientSendMessageEvents;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.minecraft.client.gui.screens.Screen;

import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.Locale;
import java.util.Set;
import java.util.Collections;
import java.util.WeakHashMap;

/**
 * Minecraft 26.3-compatible GUI and command hooks for the original TigerAuction
 * 1.1.9 ProfitLedger (including GUI sales, order intent and offline receipts).
 * Original 1.1.9 used 1.21.11 intermediary names that no longer exist.
 */
public final class EconomyMonitor263 {
    private static boolean installed;
    private static final Set<Screen> attached =
            Collections.newSetFromMap(new WeakHashMap<>());
    private EconomyMonitor263() {}

    private static void ledger(String method, String text) {
        try {
            ProfitLedger.class.getMethod(method, String.class).invoke(null, text);
        } catch (ReflectiveOperationException ex) {
            // The JAR must contain the original 1.1.9 ledger for these optional
            // methods; older databases remain untouched if unavailable.
        }
    }

    private static String title(Screen screen) {
        try { return screen.getTitle().getString(); }
        catch (RuntimeException ex) { return ""; }
    }

    private static boolean economy(String s) {
        String k=s.toLowerCase(Locale.ROOT);
        return k.contains("auction") || k.contains("order")
                || k.contains("sell") || k.contains("purchase")
                || k.contains("market") || k.contains("confirm");
    }

    public static synchronized void install() {
        if(installed)return;
        installed=true;
        ClientSendMessageEvents.COMMAND.register(command ->
                ledger("onOutgoingCommand", command));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            Screen screen=client.gui.screen();
            if(screen==null){
                ledger("onScreenTick", "");
            } else {
                ledger("onScreenTick",title(screen));
                attachToScreen(screen);
            }
        });
        ScreenEvents.AFTER_INIT.register((client, screen, width, height) ->
                attachToScreen(screen));
    }

    private static synchronized void attachToScreen(Screen screen) {
        if(screen==null || attached.contains(screen))return;
        String title=title(screen);
        if(!economy(title))return;
        attached.add(screen);
        ledger("onEconomyScreenOpened", title);
        try {
            Class<?> events=Class.forName("net.fabricmc.fabric.api.client.screen.v1.ScreenMouseEvents");
            Method getEvent=events.getMethod("afterMouseClick", Screen.class);
            Object event=getEvent.invoke(null,screen);
            Class<?> listener=Class.forName("net.fabricmc.fabric.api.client.screen.v1.ScreenMouseEvents$AfterMouseClick");
            Object callback=Proxy.newProxyInstance(listener.getClassLoader(),
                    new Class[]{listener},(proxy, method,args)->{
                if(method.getDeclaringClass()==Object.class) {
                    return switch(method.getName()) {
                        case "toString" -> "TigerAuction263MouseListener";
                        case "hashCode" -> System.identityHashCode(proxy);
                        case "equals" -> args!=null && args.length>0 && proxy==args[0];
                        default -> null;
                    };
                }
                ledger("onPossibleGuiAction",title(screen));
                Class<?> result=method.getReturnType();
                return result==boolean.class?false:null;
            });
            event.getClass().getMethod("register",Object.class).invoke(event,callback);
        } catch (ReflectiveOperationException | LinkageError ignored) {
            // Some Fabric API revisions omit this optional mouse event.
        }
    }
}
