# TigerBot: Carl-style reaction roles

The command **!rr make** starts a chat-based setup wizard. This is different from the older
**/reactroles setup** dropdown menu; both systems continue to work.

1. In a staff/admin channel, send: !rr make
2. Send the destination channel mention (such as #reaction-roles).
3. Send a color such as #FFA500 (or skip).
4. Send a title and description separated by the LAST " | ":
   🐯 Tiger Market | Ping Roles | React to choose the notifications you want!
5. Paste all lines below in ONE Discord message. The final "done" publishes the panel.

🎉 Giveaway Ping
📢 Announcement Ping
🎬 Media Ping
🎲 Gambling Ping
📦 Schematic Ping
💀 Spawner Ping
👷 Service Update Ping
🤝 Partner Ping
🤯 Community Scam/Vouch Ping
🎯 Event Ping
❌ No Pings
🔴 Stream Ping
done

The text after each emoji must match an existing server role name, or be a Discord role mention.
The wizard accepts up to 25 roles on one message.

Users click emoji reactions to obtain the matching role and remove their own
reaction to remove it. When "No Pings" is selected, TigerBot removes the
other roles from this panel; selecting another ping removes "No Pings".
This does NOT prevent @everyone, @here, or external role mentions.

Administrators can send **!rr delete MESSAGE_ID** to delete a panel managed
by the new emoji-reaction system. Send **cancel** while setting up to stop.
The setup expires after 15 minutes.

Permissions: TigerBot needs Manage Roles, its role must be ABOVE selectable
roles, and it needs View Channel, Send Messages, Embed Links, Add Reactions,
Read Message History. Give it Manage Messages to let it clear contradictory
reaction marks during No Pings changes. The Message Content intent must
be enabled in Discord's developer portal for prefix messages to be read.

Saved mappings use the bot's existing database and survive restarts as long as
the hosting platform preserves the database or fallback file.
