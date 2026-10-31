import { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder 
} from 'discord.js';

// Configuration du client avec les intents nécessaires (Guilds, Messages, Membres, Contenu)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers // Nécessaire pour les giveaways, l'envoi de MP et la gestion des membres
    ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Stockage en mémoire pour le Sticky Note (ID du salon -> { messageId, text })
const stickyNotes = new Map();

// ==========================================
// DÉFINITION DES COMMANDES SLASH
// ==========================================
const commands = [
    // --- MODÉRATION ---
    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Expulse un membre du serveur')
        .addUserOption(option => option.setName('membre').setDescription('Le membre à expulser').setRequired(true))
        .addStringOption(option => option.setName('raison').setDescription('Raison du kick'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bannit un membre du serveur')
        .addUserOption(option => option.setName('membre').setDescription('Le membre à bannir').setRequired(true))
        .addStringOption(option => option.setName('raison').setDescription('Raison du ban'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Supprime un nombre de messages')
        .addIntegerOption(option => option.setName('nombre').setDescription('Nombre de messages à supprimer (1-100)').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    // --- JEUX ---
    new SlashCommandBuilder()
        .setName('pile-ou-face')
        .setDescription('Joue à pile ou face'),

    new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('Joue à la roulette russe (attention à la casse !)')
        .addIntegerOption(option => option.setName('mise').setDescription('Votre mise').setRequired(true)),

    // --- GIVEAWAY ---
    new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Lance un giveaway')
        .addStringOption(option => option.setName('prix').setDescription('Ce qui est à gagner').setRequired(true))
        .addIntegerOption(option => option.setName('duree').setDescription('Durée en minutes').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageServer),

    // --- MEMBER AD (PUB MP) ---
    new SlashCommandBuilder()
        .setName('ad-member')
        .setDescription('Envoie un message publicitaire en MP à tous les membres du serveur')
        .addStringOption(option => option.setName('message').setDescription('Le message à envoyer en MP').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // --- STICKY NOTE ---
    new SlashCommandBuilder()
        .setName('sticky')
        .setDescription('Crée un message persistant collé au bas du salon')
        .addStringOption(option => option.setName('texte').setDescription('Le texte du sticky note').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    new SlashCommandBuilder()
        .setName('sticky-off')
        .setDescription('Désactive le sticky note de ce salon')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
].map(command => command.toJSON());

// Enregistrement automatique des commandes auprès de Discord
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('🔄 Actualisation des commandes slash...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Commandes slash enregistrées avec succès !');
    } catch (error) {
        console.error(error);
    }
})();

// ==========================================
// ÉVÉNEMENT : PRÉPARATION DU BOT (PDP & READY)
// ==========================================
client.once('ready', async () => {
    console.log(`🚀 Connecté en tant que ${client.user.tag} !`);
    client.user.setActivity('Gérer le serveur avec style ✨');
});

// ==========================================
// GESTION DES INTERACTIONS (COMMANDES SLASH)
// ==========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, guild, channel, user } = interaction;

    // --- KICK ---
    if (commandName === 'kick') {
        const member = options.getMember('membre');
        const reason = options.getString('raison') || 'Aucune raison spécifiée';
        if (!member.kickable) return interaction.reply({ content: "❌ Je ne peux pas expulser ce membre.", ephemeral: true });
        
        await member.kick(reason);
        await interaction.reply(`✅ **${member.user.tag}** a été expulsé. Raison : ${reason}`);
    }

    // --- BAN ---
    else if (commandName === 'ban') {
        const member = options.getMember('membre');
        const reason = options.getString('raison') || 'Aucune raison spécifiée';
        if (!member.bannable) return interaction.reply({ content: "❌ Je ne peux pas bannir ce membre.", ephemeral: true });
        
        await member.ban({ reason });
        await interaction.reply(`✅ **${member.user.tag}** a été banni. Raison : ${reason}`);
    }

    // --- CLEAR ---
    else if (commandName === 'clear') {
        const amount = options.getInteger('nombre');
        if (amount < 1 || amount > 100) return interaction.reply({ content: "❌ Choisis un nombre entre 1 et 100.", ephemeral: true });
        
        await channel.bulkDelete(amount, true).catch(err => {
            return interaction.reply({ content: "❌ Erreur lors de la suppression.", ephemeral: true });
        });
        await interaction.reply({ content: `🧹 **${amount}** messages ont été supprimés.`, ephemeral: true });
    }

    // --- PILE OU FACE ---
    else if (commandName === 'pile-ou-face') {
        const result = Math.random() < 0.5 ? 'Pile 🪙' : 'Face 🪙';
        await interaction.reply(`Le résultat est : **${result}** !`);
    }

    // --- ROULETTE ---
    else if (commandName === 'roulette') {
        const mise = options.getInteger('mise');
        const win = Math.random() < 0.5;
        if (win) {
            await interaction.reply(`🎉 Gagné ! Tu as doublé ta mise et remportes **${mise * 2}** jetons !`);
        } else {
            await interaction.reply(`💥 Perdu ! Tu as perdu tes **${mise}** jetons. Boum ! 💀`);
        }
    }

    // --- GIVEAWAY ---
    else if (commandName === 'giveaway') {
        const prize = options.getString('prix');
        const durationMinutes = options.getInteger('duree');

        const embed = new EmbedBuilder()
            .setTitle('🎉 **GIVEAWAY** 🎉')
            .setDescription(`Prix : **${prize}**\nRéagis avec 🎉 pour participer !\nFin dans : **${durationMinutes} minute(s)**`)
            .setColor('#5865F2')
            .setFooter({ text: `Lancé par ${user.tag}` });

        const giveawayMsg = await interaction.reply({ embeds: [embed], fetchReply: true });
        await giveawayMsg.react('🎉');

        setTimeout(async () => {
            const fetchedMsg = await channel.messages.fetch(giveawayMsg.id);
            const reaction = fetchedMsg.reactions.cache.get('🎉');
            
            if (!reaction) return channel.send("❌ Giveaway annulé (aucune réaction).");

            const users = await reaction.users.fetch();
            const participants = users.filter(u => !u.bot);

            if (participants.size === 0) {
                return channel.send(`❌ Aucun participant valide pour le giveaway de **${prize}**.`);
            }

            const winner = participants.random();
            channel.send(`🏆 Félicitations à ${winner} ! Tu remportes **${prize}** ! 🎉`);
        }, durationMinutes * 60 * 1000);
    }

    // --- MEMBER AD (PUB MP) ---
    else if (commandName === 'ad-member') {
        const adMessage = options.getString('message');
        await interaction.reply({ content: "🚀 Envoi des messages privés en cours...", ephemeral: true });

        await guild.members.fetch();
        let successCount = 0;
        let failCount = 0;

        for (const member of guild.members.cache.values()) {
            if (member.user.bot) continue;
            try {
                await member.send(`📢 **Message de la part de ${guild.name}** :\n\n${adMessage}`);
                successCount++;
            } catch (err) {
                failCount++;
            }
        }

        await interaction.followUp({ content: `✅ Campagne terminée !\n- Envoyés : ${successCount}\n- Échecs (MPs fermés) : ${failCount}`, ephemeral: true });
    }

    // --- STICKY NOTE (SET) ---
    else if (commandName === 'sticky') {
        const text = options.getString('texte');
        stickyNotes.set(channel.id, { text, messageId: null });

        const sentMsg = await channel.send(`📌 **[STICKY NOTE]**\n${text}`);
        stickyNotes.set(channel.id, { text, messageId: sentMsg.id });

        await interaction.reply({ content: "📌 Sticky note activé dans ce salon !", ephemeral: true });
    }

    // --- STICKY NOTE (OFF) ---
    else if (commandName === 'sticky-off') {
        if (!stickyNotes.has(channel.id)) {
            return interaction.reply({ content: "❌ Il n'y a pas de sticky note actif dans ce salon.", ephemeral: true });
        }
        stickyNotes.delete(channel.id);
        await interaction.reply({ content: "✅ Sticky note désactivé pour ce salon.", ephemeral: true });
    }
});

// ==========================================
// GESTION DU STICKY NOTE (RÉ-ENVOI AUTOMATIQUE)
// ==========================================
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (stickyNotes.has(message.channel.id)) {
        const sticky = stickyNotes.get(message.channel.id);

        if (sticky.messageId) {
            try {
                const oldMsg = await message.channel.messages.fetch(sticky.messageId);
                if (oldMsg) await oldMsg.delete();
            } catch (e) {}
        }

        const newStickyMsg = await message.channel.send(`📌 **[STICKY NOTE]**\n${sticky.text}`);
        sticky.messageId = newStickyMsg.id;
    }
});

// Connexion du bot
client.login(TOKEN);
