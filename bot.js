require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Constants
const LOG_CHANNEL_ID = '1370284558355791882';       // Command log channel
const NOTES_CHANNEL_ID = '1370285445245567068';     // Notes channel
const messageCache = new Map();                     // To store roll messages for editing

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Helper to log commands
async function logCommand(guild, embed) {
  try {
    const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID);
    if (logChannel && logChannel.isTextBased()) {
      await logChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Failed to log command:', error);
  }
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // 🎲 Handle !roll
  if (message.content === '!roll') {
    try {
      const embed = new EmbedBuilder()
        .setTitle('🎲 D&D Dice Roller')
        .setDescription('Select a die to roll from below:')
        .setColor(0x9B59B6)
        .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() });

      const buttons = [
        new ButtonBuilder().setCustomId('d4').setLabel('Roll d4').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('d6').setLabel('Roll d6').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('d8').setLabel('Roll d8').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('d20').setLabel('Roll d20').setStyle(ButtonStyle.Success)
      ];

      const rows = [
        new ActionRowBuilder().addComponents(buttons.slice(0, 2)),
        new ActionRowBuilder().addComponents(buttons.slice(2, 4))
      ];

      const sent = await message.channel.send({ embeds: [embed], components: rows });
      messageCache.set(message.channel.id, sent.id);
      await message.delete();

      const logEmbed = new EmbedBuilder()
        .setTitle('🧙 Command Used: !roll')
        .setDescription(`**${message.author.tag}** used \`!roll\` in <#${message.channel.id}>`)
        .setTimestamp()
        .setColor(0x9B59B6)
        .setFooter({ text: `User ID: ${message.author.id}` });

      await logCommand(message.guild, logEmbed);
    } catch (error) {
      console.error('Error creating roll message:', error);
    }
  }

  // 🧹 Handle !purge
  if (message.content.startsWith('!purge')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    const args = message.content.split(' ');
    const amount = parseInt(args[1]);

    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply('⚠️ Please provide a number between 1 and 100.');
    }

    try {
      await message.channel.bulkDelete(amount + 1, true);
      const confirmMsg = await message.channel.send(`🧹 Deleted ${amount} messages.`);
      setTimeout(() => confirmMsg.delete().catch(() => {}), 3000);

      const logEmbed = new EmbedBuilder()
        .setTitle('🧹 Command Used: !purge')
        .setDescription(`**${message.author.tag}** purged **${amount}** messages in <#${message.channel.id}>`)
        .setTimestamp()
        .setColor(0xE67E22)
        .setFooter({ text: `User ID: ${message.author.id}` });

      await logCommand(message.guild, logEmbed);
    } catch (error) {
      console.error('Error deleting messages:', error);
      message.reply('❌ There was an error trying to delete messages.');
    }
  }

  // 📝 Handle !note
  if (message.content.startsWith('!note')) {
    const noteText = message.content.slice(5).trim();

    if (!noteText) {
      return message.reply('📝 You must provide some text for the note.');
    }

    const noteEmbed = new EmbedBuilder()
      .setTitle('📒 New Note')
      .setDescription(noteText)
      .setColor(0xF1C40F)
      .setTimestamp()
      .setFooter({
        text: `By ${message.author.tag}`,
        iconURL: message.author.displayAvatarURL()
      });

    try {
      const notesChannel = await message.guild.channels.fetch(NOTES_CHANNEL_ID);
      if (notesChannel && notesChannel.isTextBased()) {
        await notesChannel.send({ embeds: [noteEmbed] });
        await message.delete();

        const logEmbed = new EmbedBuilder()
          .setTitle('📒 Command Used: !note')
          .setDescription(`**${message.author.tag}** submitted a note in <#${message.channel.id}>`)
          .addFields({ name: 'Note:', value: noteText })
          .setTimestamp()
          .setColor(0xF1C40F)
          .setFooter({ text: `User ID: ${message.author.id}` });

        await logCommand(message.guild, logEmbed);
      } else {
        throw new Error('Notes channel not found or not text-based');
      }
    } catch (error) {
      console.error('Failed to send note:', error);
      await message.reply('❌ Could not send note. Please check permissions or channel settings.');
    }
  }
});

// 🎲 Handle Button Interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  try {
    const dieType = interaction.customId;
    const max = { d4: 4, d6: 6, d8: 8, d20: 20 }[dieType] || 6;
    const roll = Math.floor(Math.random() * max) + 1;
    const critical = dieType === 'd20' && (roll === 1 || roll === 20);
    let color = 0x3498DB;

    if (critical) {
      color = roll === 20 ? 0x2ECC71 : 0xE74C3C;
    }

    const resultEmbed = new EmbedBuilder()
      .setTitle(`🎲 ${critical ? (roll === 20 ? '💥 NATURAL 20!' : '☠️ CRITICAL FAIL!') : `You rolled a ${dieType.toUpperCase()}`}`)
      .setDescription(`**${interaction.user.username}** rolled a **${roll}** on a **${dieType.toUpperCase()}**.`)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setColor(color)
      .setFooter({ text: `Rolled by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    const buttons = [
      new ButtonBuilder().setCustomId('d4').setLabel('Roll d4').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('d6').setLabel('Roll d6').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('d8').setLabel('Roll d8').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('d20').setLabel('Roll d20').setStyle(ButtonStyle.Success)
    ];

    const rows = [
      new ActionRowBuilder().addComponents(buttons.slice(0, 2)),
      new ActionRowBuilder().addComponents(buttons.slice(2, 4))
    ];

    const messageId = messageCache.get(interaction.channel.id);
    if (messageId) {
      const originalMessage = await interaction.channel.messages.fetch(messageId);
      await originalMessage.edit({ embeds: [resultEmbed], components: rows });
    }

    await interaction.deferUpdate();

    const logEmbed = new EmbedBuilder()
      .setTitle(`🎲 Dice Rolled`)
      .setDescription(`**${interaction.user.tag}** rolled a **${roll}** on a **${dieType.toUpperCase()}** in <#${interaction.channel.id}>`)
      .setTimestamp()
      .setColor(color)
      .setFooter({ text: `User ID: ${interaction.user.id}` });

    await logCommand(interaction.guild, logEmbed);
  } catch (error) {
    console.error('Error handling interaction:', error);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ Error processing the roll.', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
