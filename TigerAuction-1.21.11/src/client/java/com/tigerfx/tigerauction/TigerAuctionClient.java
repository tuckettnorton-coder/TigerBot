package com.tigerfx.tigerauction;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.Style;
import net.minecraft.network.chat.TextColor;
import net.minecraft.resources.Identifier;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import org.lwjgl.glfw.GLFW;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Client-only DonutSMP auction timer and payment tracker. */
public final class TigerAuctionClient implements ClientModInitializer {
    private static final String MOD_ID = "tigerauction";
    private static final Path CONFIG_PATH = FabricLoader.getInstance().getConfigDir().resolve("tigerauction.properties");

    private static final Pattern PAID_YOU_PATTERN = Pattern.compile(
            "(?i)([a-z0-9_]{3,16})\\s+paid you\\s+\\$?\\s*([0-9][0-9,]*(?:\\.[0-9]+)?\\s*[kmbt]?)"
    );
    private static final Pattern RECEIVED_PATTERN = Pattern.compile(
            "(?i)you\\s+(?:have\\s+)?received\\s+\\$?\\s*([0-9][0-9,]*(?:\\.[0-9]+)?\\s*[kmbt]?)\\s+from\\s+([a-z0-9_]{3,16})"
    );

    private static Minecraft minecraft;
    private static AuctionConfig config;
    private static KeyMapping openMenuKey;
    private static KeyMapping toggleEnabledKey;

    private static boolean auctionActive;
    private static long auctionEndTimeMs;
    private static Item auctionItem = Items.DIAMOND;
    private static int auctionQuantity = 1;
    private static long auctionMinimumBid;
    private static String auctionHostName = "";
    private static final Map<String, Long> highestBidByPlayer = new LinkedHashMap<>();

    @Override
    public void onInitializeClient() {
        minecraft = Minecraft.getInstance();
        config = AuctionConfig.load();

        openMenuKey = KeyBindingHelper.registerKeyBinding(new KeyMapping(
                "key.tigerauction.open_menu",
                InputConstants.Type.KEYSYM,
                GLFW.GLFW_KEY_O,
                KeyMapping.Category.MISC
        ));
        toggleEnabledKey = KeyBindingHelper.registerKeyBinding(new KeyMapping(
                "key.tigerauction.toggle_enabled",
                InputConstants.Type.KEYSYM,
                GLFW.GLFW_KEY_F8,
                KeyMapping.Category.MISC
        ));

        ClientTickEvents.END_CLIENT_TICK.register(TigerAuctionClient::onClientTick);
        ClientReceiveMessageEvents.GAME.register((message, overlay) -> handleServerGameMessage(message));
    }

    private static void onClientTick(Minecraft client) {
        while (openMenuKey.consumeClick()) {
            if (config.openMenuHotkeyEnabled) {
                client.setScreen(new AuctionConfigScreen(client.screen));
            }
        }

        while (toggleEnabledKey.consumeClick()) {
            config.enabled = !config.enabled;
            AuctionConfig.save(config);
            localMessage(config.enabled
                    ? "Tiger Auction enabled. Opening configuration."
                    : "Tiger Auction disabled for new auctions. Any running auction will continue.");
            if (config.enabled) {
                client.setScreen(new AuctionConfigScreen(client.screen));
            }
        }

        if (auctionActive && System.currentTimeMillis() >= auctionEndTimeMs
                && client.player != null && client.getConnection() != null) {
            finishAuction();
        }
    }

    private static void handleServerGameMessage(Component message) {
        if (!auctionActive || minecraft == null || minecraft.player == null || !isDonutServer()) {
            return;
        }

        String plain = message.getString();
        ParsedPayment payment = parsePayment(plain);
        if (payment == null) {
            return;
        }

        // DonutSMP renders its receipt as a green server/system message. Requiring green
        // styled text helps avoid treating ordinary player chat as a real payment receipt.
        if (!containsGreenStyle(message)) {
            return;
        }

        String playerName = payment.playerName;
        if (playerName.equalsIgnoreCase(auctionHostName) || payment.amount <= 0) {
            return;
        }
        if (auctionMinimumBid > 0 && payment.amount < auctionMinimumBid) {
            return;
        }

        long oldBest = highestBidByPlayer.getOrDefault(playerName, 0L);
        if (payment.amount > oldBest) {
            highestBidByPlayer.put(playerName, payment.amount);
            localMessage("Bid recorded: " + playerName + " — " + formatMoney(payment.amount));
        }
    }

    private static ParsedPayment parsePayment(String line) {
        Matcher first = PAID_YOU_PATTERN.matcher(line);
        if (first.find()) {
            Long amount = parseMoney(first.group(2));
            if (amount != null) {
                return new ParsedPayment(first.group(1), amount);
            }
        }

        Matcher second = RECEIVED_PATTERN.matcher(line);
        if (second.find()) {
            Long amount = parseMoney(second.group(1));
            if (amount != null) {
                return new ParsedPayment(second.group(2), amount);
            }
        }
        return null;
    }

    private static boolean containsGreenStyle(Component component) {
        Style style = component.getStyle();
        TextColor color = style.getColor();
        if (color != null) {
            int rgb = color.getValue();
            int red = (rgb >> 16) & 0xFF;
            int green = (rgb >> 8) & 0xFF;
            int blue = rgb & 0xFF;
            if (green >= 130 && green > red * 1.15 && green > blue * 1.15) {
                return true;
            }
        }
        for (Component sibling : component.getSiblings()) {
            if (containsGreenStyle(sibling)) {
                return true;
            }
        }
        return false;
    }

    private static Long parseMoney(String input) {
        if (input == null) return null;
        String normalized = input.trim().replace(",", "").replace(" ", "").toUpperCase(Locale.ROOT);
        if (normalized.isEmpty()) return null;

        BigDecimal multiplier = BigDecimal.ONE;
        char last = normalized.charAt(normalized.length() - 1);
        if (Character.isLetter(last)) {
            normalized = normalized.substring(0, normalized.length() - 1);
            multiplier = switch (last) {
                case 'K' -> BigDecimal.valueOf(1_000L);
                case 'M' -> BigDecimal.valueOf(1_000_000L);
                case 'B' -> BigDecimal.valueOf(1_000_000_000L);
                case 'T' -> BigDecimal.valueOf(1_000_000_000_000L);
                default -> BigDecimal.ONE;
            };
        }

        try {
            BigDecimal value = new BigDecimal(normalized).multiply(multiplier);
            if (value.signum() < 0) return null;
            return value.setScale(0, RoundingMode.DOWN).longValueExact();
        } catch (ArithmeticException | NumberFormatException ignored) {
            return null;
        }
    }

    private static boolean isDonutServer() {
        if (minecraft == null) return false;
        ServerData server = minecraft.getCurrentServer();
        return server != null && server.ip != null && server.ip.toLowerCase(Locale.ROOT).contains("donutsmp");
    }

    private static void startAuction(Item item, int quantity, long minimumBid, int durationSeconds) {
        if (!config.enabled) {
            localMessage("Tiger Auction is disabled. Press F8 or enable it in the menu.");
            return;
        }
        if (auctionActive) {
            localMessage("An auction is already running. Stop it before starting another.");
            return;
        }
        if (minecraft == null || minecraft.player == null || minecraft.getConnection() == null) {
            localMessage("Join DonutSMP before starting an auction.");
            return;
        }
        if (!isDonutServer()) {
            localMessage("This auction tracker is configured for DonutSMP. Join a server address containing 'donutsmp'.");
            return;
        }

        auctionItem = item;
        auctionQuantity = quantity;
        auctionMinimumBid = minimumBid;
        auctionHostName = minecraft.player.getGameProfile().name();
        auctionEndTimeMs = System.currentTimeMillis() + durationSeconds * 1000L;
        highestBidByPlayer.clear();
        auctionActive = true;

        String itemName = itemName(item);
        String minimumText = minimumBid > 0 ? "Minimum bid: " + formatMoney(minimumBid) : "No minimum bid";
        sendChat("[Tiger Auction] STARTED: " + quantity + "x " + itemName + " | " + minimumText
                + " | " + formatDuration(durationSeconds) + ". Pay " + auctionHostName
                + " using /pay " + auctionHostName + " <amount> to bid. Highest eligible payment wins.");
        localMessage("Auction started. The prize must be delivered manually to the winner.");
        AuctionConfig.save(config);
    }

    private static void finishAuction() {
        if (!auctionActive) return;

        String winner = null;
        long winnerAmount = -1L;
        for (Map.Entry<String, Long> entry : highestBidByPlayer.entrySet()) {
            if (entry.getValue() > winnerAmount) {
                winner = entry.getKey();
                winnerAmount = entry.getValue();
            }
        }

        auctionActive = false;
        if (winner == null) {
            String endReason = auctionMinimumBid > 0
                    ? "No winner: no payment met the minimum of " + formatMoney(auctionMinimumBid)
                    : "No winner: no positive payment was received";
            sendChat("[Tiger Auction] ENDED: " + endReason + " for "
                    + auctionQuantity + "x " + itemName(auctionItem) + ".");
            localMessage("Auction ended with no eligible winner.");
        } else {
            sendChat("[Tiger Auction] ENDED: " + winner + " wins " + auctionQuantity + "x " + itemName(auctionItem)
                    + " with a highest payment of " + formatMoney(winnerAmount) + "!");
            localMessage("Winner: " + winner + " — " + formatMoney(winnerAmount));
        }
    }

    private static void cancelAuction() {
        if (!auctionActive) {
            localMessage("There is no active auction.");
            return;
        }
        auctionActive = false;
        String host = minecraft != null && minecraft.player != null
                ? minecraft.player.getGameProfile().name() : auctionHostName;
        sendChat("[Tiger Auction] CANCELLED by " + host + ". No winner was selected.");
        localMessage("Auction cancelled.");
    }

    private static void sendChat(String message) {
        if (minecraft != null && minecraft.player != null && minecraft.getConnection() != null) {
            minecraft.getConnection().sendChat(message);
        }
    }

    private static void localMessage(String message) {
        if (minecraft != null && minecraft.player != null) {
            minecraft.player.displayClientMessage(Component.literal("[Tiger Auction] " + message), false);
        }
    }

    private static String formatMoney(long amount) {
        return "$" + NumberFormat.getIntegerInstance(Locale.US).format(amount);
    }

    private static String formatDuration(int seconds) {
        int minutes = seconds / 60;
        int remainder = seconds % 60;
        if (minutes > 0 && remainder > 0) return minutes + "m " + remainder + "s";
        if (minutes > 0) return minutes + " minute(s)";
        return seconds + " seconds";
    }

    private static String itemName(Item item) {
        return new ItemStack(item).getHoverName().getString();
    }

    private static Item itemFromId(String id) {
        try {
            Identifier key = Identifier.parse(id);
            return BuiltInRegistries.ITEM.get(key)
                    .map(reference -> reference.value())
                    .filter(item -> item != Items.AIR)
                    .orElse(Items.DIAMOND);
        } catch (RuntimeException ignored) {
            return Items.DIAMOND;
        }
    }

    private static String idOf(Item item) {
        return BuiltInRegistries.ITEM.getKey(item).toString();
    }

    private record ParsedPayment(String playerName, long amount) { }

    private static final class AuctionConfig {
        private boolean enabled = true;
        private boolean openMenuHotkeyEnabled = true;
        private String itemId = "minecraft:diamond";
        private int quantity = 1;
        private long minimumBid = 1_000_000L;
        private int durationSeconds = 60;

        private static AuctionConfig load() {
            AuctionConfig loaded = new AuctionConfig();
            if (!Files.exists(CONFIG_PATH)) return loaded;

            Properties values = new Properties();
            try (var input = Files.newInputStream(CONFIG_PATH)) {
                values.load(input);
                loaded.enabled = Boolean.parseBoolean(values.getProperty("enabled", "true"));
                loaded.openMenuHotkeyEnabled = Boolean.parseBoolean(values.getProperty("openMenuHotkeyEnabled", "true"));
                loaded.itemId = values.getProperty("itemId", "minecraft:diamond");
                loaded.quantity = clamp(parseInt(values.getProperty("quantity"), 1), 1, 999999);
                loaded.minimumBid = Math.max(0L, parseLong(values.getProperty("minimumBid"), 1_000_000L));
                loaded.durationSeconds = clamp(parseInt(values.getProperty("durationSeconds"), 60), 5, 86400);
            } catch (IOException ignored) {
                return new AuctionConfig();
            }
            return loaded;
        }

        private static void save(AuctionConfig value) {
            Properties values = new Properties();
            values.setProperty("enabled", Boolean.toString(value.enabled));
            values.setProperty("openMenuHotkeyEnabled", Boolean.toString(value.openMenuHotkeyEnabled));
            values.setProperty("itemId", value.itemId);
            values.setProperty("quantity", Integer.toString(value.quantity));
            values.setProperty("minimumBid", Long.toString(value.minimumBid));
            values.setProperty("durationSeconds", Integer.toString(value.durationSeconds));
            try {
                Files.createDirectories(CONFIG_PATH.getParent());
                try (var output = Files.newOutputStream(CONFIG_PATH)) {
                    values.store(output, "Tiger Auction settings");
                }
            } catch (IOException exception) {
                System.err.println("[Tiger Auction] Could not save config: " + exception.getMessage());
            }
        }
    }

    private static int parseInt(String value, int fallback) {
        try { return Integer.parseInt(value); } catch (RuntimeException ignored) { return fallback; }
    }

    private static long parseLong(String value, long fallback) {
        try { return Long.parseLong(value); } catch (RuntimeException ignored) { return fallback; }
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static final class AuctionConfigScreen extends Screen {
        private final Screen previousScreen;
        private EditBox searchBox;
        private EditBox quantityBox;
        private EditBox minimumBidBox;
        private EditBox minutesBox;
        private EditBox secondsBox;
        private List<Item> allItems;
        private List<Item> filteredItems;
        private int page;
        private int columns;
        private int rows;
        private int gridX;
        private int gridY;
        private int leftWidth;
        private int cellWidth;
        private int pageSize;
        private Button enabledButton;
        private Button menuHotkeyButton;

        private AuctionConfigScreen(Screen previousScreen) {
            super(Component.literal("Tiger Auction"));
            this.previousScreen = previousScreen;
        }

        @Override
        protected void init() {
            int leftX = 14;
            leftWidth = Math.max(120, this.width / 2 - 23);
            gridX = leftX;
            gridY = 75;
            columns = Math.max(2, Math.min(5, leftWidth / 54));
            rows = Math.max(2, Math.min(5, (this.height - 170) / 38));
            cellWidth = leftWidth / columns;
            pageSize = columns * rows;

            List<Item> registryItems = new ArrayList<>();
            BuiltInRegistries.ITEM.stream()
                    .filter(item -> item != Items.AIR)
                    .forEach(registryItems::add);
            registryItems.sort(Comparator.comparing(TigerAuctionClient::itemName, String.CASE_INSENSITIVE_ORDER));
            allItems = registryItems;
            filteredItems = filteredItems();

            int searchWidth = Math.max(60, leftWidth - 62);
            searchBox = new EditBox(this.font, leftX, 42, searchWidth, 20, Component.literal("Search items"));
            searchBox.setMaxLength(80);
            searchBox.setHint(Component.literal("Search items..."));
            searchBox.setResponder(value -> {
                page = 0;
                filteredItems = filteredItems();
            });
            addRenderableWidget(searchBox);
            addRenderableWidget(Button.builder(Component.literal("<"), button -> page = Math.max(0, page - 1))
                    .bounds(leftX + leftWidth - 56, 42, 25, 20).build());
            addRenderableWidget(Button.builder(Component.literal(">"), button -> page = Math.min(maxPage(), page + 1))
                    .bounds(leftX + leftWidth - 28, 42, 25, 20).build());

            int rightX = this.width / 2 + 8;
            int rightWidth = Math.max(100, this.width - rightX - 14);

            quantityBox = numberBox(rightX, 111, Math.min(145, rightWidth), Integer.toString(config.quantity), 7);
            minimumBidBox = new EditBox(this.font, rightX, 153, rightWidth, 20, Component.literal("Minimum bid"));
            minimumBidBox.setMaxLength(24);
            minimumBidBox.setFilter(value -> value.matches("[0-9,.kKmMbBtT]*"));
            minimumBidBox.setValue(Long.toString(config.minimumBid));
            addRenderableWidget(minimumBidBox);

            int timerFieldWidth = Math.max(43, Math.min(74, (rightWidth - 34) / 2));
            minutesBox = numberBox(rightX, 199, timerFieldWidth, Integer.toString(config.durationSeconds / 60), 4);
            secondsBox = numberBox(rightX + timerFieldWidth + 8, 199, timerFieldWidth, Integer.toString(config.durationSeconds % 60), 2);

            int buttonY = this.height - 28;
            int gap = 4;
            int buttonWidth = Math.max(48, (this.width - 28 - 3 * gap) / 4);
            enabledButton = Button.builder(enabledLabel(), button -> {
                captureFields();
                config.enabled = !config.enabled;
                AuctionConfig.save(config);
                enabledButton.setMessage(enabledLabel());
            }).bounds(14, buttonY, buttonWidth, 20).build();
            addRenderableWidget(enabledButton);

            menuHotkeyButton = Button.builder(menuHotkeyLabel(), button -> {
                captureFields();
                config.openMenuHotkeyEnabled = !config.openMenuHotkeyEnabled;
                AuctionConfig.save(config);
                menuHotkeyButton.setMessage(menuHotkeyLabel());
            }).bounds(14 + buttonWidth + gap, buttonY, buttonWidth, 20).build();
            addRenderableWidget(menuHotkeyButton);

            addRenderableWidget(Button.builder(Component.literal("Stop"), button -> cancelAuction())
                    .bounds(14 + (buttonWidth + gap) * 2, buttonY, buttonWidth, 20).build());
            addRenderableWidget(Button.builder(Component.literal("Start"), button -> {
                if (captureFields()) {
                    AuctionConfig.save(config);
                    startAuction(itemFromId(config.itemId), config.quantity, config.minimumBid, config.durationSeconds);
                }
            }).bounds(14 + (buttonWidth + gap) * 3, buttonY, buttonWidth, 20).build());
        }

        private EditBox numberBox(int x, int y, int width, String value, int maxLength) {
            EditBox box = new EditBox(this.font, x, y, width, 20, Component.empty());
            box.setMaxLength(maxLength);
            box.setFilter(input -> input.matches("[0-9]*"));
            box.setValue(value);
            addRenderableWidget(box);
            return box;
        }

        private Component enabledLabel() {
            return Component.literal("Enabled: " + (config.enabled ? "ON" : "OFF"));
        }

        private Component menuHotkeyLabel() {
            return Component.literal("Menu key: " + (config.openMenuHotkeyEnabled ? "ON" : "OFF"));
        }

        private boolean captureFields() {
            config.itemId = idOf(itemFromId(config.itemId));
            int quantity = parseInt(quantityBox.getValue(), 1);
            quantity = clamp(quantity, 1, 999999);

            Long minimum = parseMoney(minimumBidBox.getValue());
            if (minimum == null) {
                localMessage("Minimum bid is invalid. Use an amount like 1000000, 1M, or 500K.");
                return false;
            }

            int minutes = clamp(parseInt(minutesBox.getValue(), 0), 0, 1440);
            int seconds = clamp(parseInt(secondsBox.getValue(), 0), 0, 59);
            int duration = minutes * 60 + seconds;
            if (duration < 5 || duration > 86400) {
                localMessage("Timer must be between 5 seconds and 24 hours.");
                return false;
            }

            config.quantity = quantity;
            config.minimumBid = Math.max(0L, minimum);
            config.durationSeconds = duration;
            return true;
        }

        private List<Item> filteredItems() {
            String query = searchBox == null ? "" : searchBox.getValue().trim().toLowerCase(Locale.ROOT);
            if (allItems == null || query.isEmpty()) {
                return allItems == null ? List.of() : allItems;
            }
            List<Item> result = new ArrayList<>();
            for (Item item : allItems) {
                String name = itemName(item).toLowerCase(Locale.ROOT);
                String id = idOf(item).toLowerCase(Locale.ROOT);
                if (name.contains(query) || id.contains(query)) result.add(item);
            }
            return result;
        }

        private int maxPage() {
            return Math.max(0, (filteredItems.size() - 1) / Math.max(1, pageSize));
        }

        @Override
        public void render(GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
            renderBackground(graphics, mouseX, mouseY, partialTick);
            graphics.drawCenteredString(this.font, "Tiger Auction", this.width / 2, 12, 0xFFD56A);
            graphics.drawString(this.font, "Search any Minecraft item", 14, 30, 0xD0D0D0);

            int rightX = this.width / 2 + 8;
            Item selectedItem = itemFromId(config.itemId);
            graphics.drawString(this.font, "PRIZE ITEM", rightX, 36, 0xFFD56A);
            graphics.renderItem(new ItemStack(selectedItem), rightX, 50);
            drawTrimmed(graphics, itemName(selectedItem), rightX + 22, 53,
                    Math.max(20, this.width - rightX - 26), 0xFFFFFF);
            graphics.drawString(this.font, "Quantity (items)", rightX, 94, 0xE4E4E4);
            graphics.drawString(this.font, "Minimum payment ($; 0 = none)", rightX, 136, 0xE4E4E4);
            graphics.drawString(this.font, "Timer: minutes / seconds", rightX, 182, 0xE4E4E4);
            graphics.drawString(this.font, "Accepts 1M or 500K", rightX, 223, 0x999999);

            graphics.drawString(this.font, "Items: " + filteredItems.size() + "  Page " + (page + 1) + "/" + (maxPage() + 1),
                    14, 64, 0xBDBDBD);

            int start = page * pageSize;
            int end = Math.min(filteredItems.size(), start + pageSize);
            for (int index = start; index < end; index++) {
                Item item = filteredItems.get(index);
                int local = index - start;
                int column = local % columns;
                int row = local / columns;
                int x = gridX + column * cellWidth;
                int y = gridY + row * 38;
                boolean isSelected = idOf(item).equals(config.itemId);
                int background = isSelected ? 0xFF65502B : 0xFF24272B;
                if (mouseX >= x && mouseX < x + cellWidth - 3 && mouseY >= y && mouseY < y + 34) {
                    background = isSelected ? 0xFF806737 : 0xFF383D43;
                }
                graphics.fill(x, y, x + cellWidth - 3, y + 34, background);
                graphics.renderItem(new ItemStack(item), x + (cellWidth - 16) / 2 - 1, y + 1);
                String name = itemName(item);
                String shortName = trimToWidth(name, Math.max(12, cellWidth - 7));
                graphics.drawCenteredString(this.font, shortName, x + (cellWidth - 3) / 2, y + 21,
                        isSelected ? 0xFFFFCC : 0xE5E5E5);
            }

            if (auctionActive) {
                long remaining = Math.max(0L, (auctionEndTimeMs - System.currentTimeMillis() + 999L) / 1000L);
                String top = currentTopBidSummary();
                drawTrimmed(graphics, "RUNNING — " + formatDuration((int) remaining) + " remaining | " + top,
                        14, this.height - 47, this.width - 28, 0xFFDD77);
            } else {
                drawTrimmed(graphics, "System: " + (config.enabled ? "ON" : "OFF")
                                + " | Payments below the minimum do not qualify. Prize delivery is manual.",
                        14, this.height - 47, this.width - 28, 0xBDBDBD);
            }

            super.render(graphics, mouseX, mouseY, partialTick);
        }

        private String currentTopBidSummary() {
            String winner = null;
            long amount = -1L;
            for (Map.Entry<String, Long> entry : highestBidByPlayer.entrySet()) {
                if (entry.getValue() > amount) {
                    winner = entry.getKey();
                    amount = entry.getValue();
                }
            }
            return winner == null ? "No eligible bids yet" : "Top: " + winner + " " + formatMoney(amount);
        }

        private String trimToWidth(String input, int maximumWidth) {
            String result = input;
            while (!result.isEmpty() && this.font.width(result) > maximumWidth) {
                result = result.substring(0, result.length() - 1);
            }
            if (!result.equals(input) && result.length() > 1) {
                result = result.substring(0, Math.max(1, result.length() - 1)) + "…";
            }
            return result;
        }

        private void drawTrimmed(GuiGraphics graphics, String text, int x, int y, int maxWidth, int color) {
            graphics.drawString(this.font, trimToWidth(text, maxWidth), x, y, color);
        }

        @Override
        public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
            double mouseX = event.x();
            double mouseY = event.y();
            int button = event.button();
            if (button == 0 && mouseX >= gridX && mouseX < gridX + leftWidth
                    && mouseY >= gridY && mouseY < gridY + rows * 38) {
                int column = Math.max(0, Math.min(columns - 1, (int) (mouseX - gridX) / cellWidth));
                int row = Math.max(0, (int) (mouseY - gridY) / 38);
                int index = page * pageSize + row * columns + column;
                if (index >= page * pageSize && index < filteredItems.size() && row < rows) {
                    Item item = filteredItems.get(index);
                    config.itemId = idOf(item);
                    return true;
                }
            }
            return super.mouseClicked(event, doubleClick);
        }

        @Override
        public boolean mouseScrolled(double mouseX, double mouseY, double horizontalAmount, double verticalAmount) {
            if (mouseX >= gridX && mouseX < gridX + leftWidth) {
                page = clamp(page + (verticalAmount < 0 ? 1 : -1), 0, maxPage());
                return true;
            }
            return super.mouseScrolled(mouseX, mouseY, horizontalAmount, verticalAmount);
        }

        @Override
        public void onClose() {
            captureFields();
            AuctionConfig.save(config);
            minecraft.setScreen(previousScreen);
        }
    }
}
