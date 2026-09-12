#!/usr/bin/env node

/**
 * Plugin Compiler - Templates Inteligentes
 * Genera plugins de Minecraft en 5 segundos sin costo
 * GRATIS e ILIMITADO
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// ==================== CONFIG ====================

const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(os.tmpdir(), 'plugins-templates');
const OUTPUT_DIR = path.join(__dirname, 'compilados');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ==================== LOGGER ====================

function log(msg, type = 'info') {
    const colors = {
        info: '\x1b[36m',
        success: '\x1b[32m',
        error: '\x1b[31m',
        warning: '\x1b[33m'
    };
    console.log(`${colors[type]}[${type.toUpperCase()}]\x1b[0m ${msg}`);
}

// ==================== DETECTOR DE PALABRAS CLAVE ====================

function detectarCaracteristicas(descripcion) {
    const desc = descripcion.toLowerCase();
    
    const caracteristicas = {
        economia: /dinero|vault|eco|economia|precio|costo|pagar|cobrar|banco|moneda/.test(desc),
        gui: /gui|interfaz|inventario|menu|clickeable|boton|pantalla|visual/.test(desc),
        comandos: /comando|\/|cmd|command/.test(desc),
        racha: /racha|consecutivo|streak|dias seguidos|cadena/.test(desc),
        eventos: /evento|join|leave|muerte|muerte|entrar|salir/.test(desc),
        base_datos: /datos|guardar|persistente|storage|base|sql|database/.test(desc),
        permisos: /permiso|permission|admin|vip|rango|grupo/.test(desc),
        warps: /warp|teletransport|tp|teleport/.test(desc),
        stats: /estadisticas|stats|ranking|kills|deaths/.test(desc),
        chat: /chat|mensaje|anuncio|broadcast|notificacion/.test(desc)
    };

    return caracteristicas;
}

// ==================== GENERADOR DE MAIN.JAVA ====================

function generarMainJava(nombre, caracteristicas) {
    const clase = nombre.charAt(0).toUpperCase() + nombre.slice(1);
    const paquete = `com.plugin.${nombre.toLowerCase()}`;

    let imports = `package ${paquete};

import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.Bukkit;`;

    if (caracteristicas.economia) {
        imports += `\nimport net.milkbowl.vault.economy.Economy;
import org.bukkit.plugin.RegisteredServiceProvider;`;
    }

    if (caracteristicas.gui || caracteristicas.eventos) {
        imports += `\nimport org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;`;
    }

    if (caracteristicas.base_datos) {
        imports += `\nimport java.io.File;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;`;
    }

    let campos = '';
    if (caracteristicas.economia) {
        campos += `\n    private Economy economy = null;`;
    }

    let metodoEconomia = '';
    if (caracteristicas.economia) {
        metodoEconomia = `\n    private boolean setupEconomy() {
        if (getServer().getPluginManager().getPlugin("Vault") == null) {
            return false;
        }
        RegisteredServiceProvider<Economy> rsp = 
            getServer().getServicesManager().getRegistration(Economy.class);
        if (rsp == null) {
            return false;
        }
        economy = rsp.getProvider();
        return economy != null;
    }`;
    }

    let metodoComandos = `\n    @Override
    public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
        if (!(sender instanceof Player)) {
            sender.sendMessage(ChatColor.RED + "Solo jugadores pueden usar esto");
            return true;
        }
        
        Player player = (Player) sender;
        
        if (cmd.getName().equalsIgnoreCase("${nombre.toLowerCase()}")) {`;

    if (caracteristicas.economia) {
        metodoComandos += `\n            player.sendMessage(ChatColor.GOLD + "Balance: $" + economy.getBalance(player));`;
    } else {
        metodoComandos += `\n            player.sendMessage(ChatColor.GREEN + "${nombre} v" + this.getDescription().getVersion());`;
    }

    metodoComandos += `\n            return true;
        }
        return false;
    }`;

    const codigo = `${imports}

/**
 * ${clase}
 * Versión: 1.0
 */
public class Main extends JavaPlugin implements Listener {
    ${campos}
    
    @Override
    public void onEnable() {
        getLogger().info("§a━━━━━━━━━━━━━━━━━━");
        getLogger().info("§6${clase} §aActivado");
        getLogger().info("§a━━━━━━━━━━━━━━━━━━");
        
        ${caracteristicas.economia ? 'if (!setupEconomy()) { getLogger().warning("Vault no encontrado"); }' : 'getLogger().info("§bVersión: 1.0");'}
        ${caracteristicas.gui || caracteristicas.eventos ? 'getServer().getPluginManager().registerEvents(this, this);' : ''}
    }
    
    @Override
    public void onDisable() {
        getLogger().info("§c${clase} Desactivado");
    }${metodoEconomia}${metodoComandos}
    
    ${caracteristicas.eventos ? `@EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        player.sendMessage(ChatColor.GREEN + "¡Bienvenido " + player.getName() + "!");
    }` : ''}
}`;

    return codigo;
}

// ==================== GENERADOR DE PLUGIN.YML ====================

function generarPluginYml(nombre, descripcion, caracteristicas) {
    let yml = `name: ${nombre}
main: com.plugin.${nombre.toLowerCase()}.Main
version: 1.0
description: ${descripcion.substring(0, 100)}
author: Generado Automáticamente

commands:
  ${nombre.toLowerCase()}:
    description: Comando principal
    usage: /${nombre.toLowerCase()}
    aliases:
      - ${nombre.toLowerCase().substring(0, 3)}

permissions:
  ${nombre.toLowerCase()}.use:
    description: Usar el plugin
    default: true
  ${nombre.toLowerCase()}.admin:
    description: Permisos de administrador
    default: op`;

    if (caracteristicas.economia) {
        yml += `\n\ndepend:
  - Vault`;
    }

    if (caracteristicas.permisos) {
        yml += `\n\npermissions:
  ${nombre.toLowerCase()}.vip:
    description: Rango VIP
    default: false`;
    }

    return yml;
}

// ==================== MAPA DE VERSIONES ====================

const VERSION_MAP = {
    '1.21.4': { paper: '1.21.4-106', bukkit: '1.21.4' },
    '1.21.3': { paper: '1.21.3-102', bukkit: '1.21.3' },
    '1.21.2': { paper: '1.21.2-99', bukkit: '1.21.2' },
    '1.21.1': { paper: '1.21.1-83', bukkit: '1.21.1' },
    '1.21': { paper: '1.21-79', bukkit: '1.21' },
    '1.20.6': { paper: '1.20.6-96', bukkit: '1.20.6' },
    '1.20.5': { paper: '1.20.5-94', bukkit: '1.20.5' },
    '1.20.4': { paper: '1.20.4-88', bukkit: '1.20.4' },
    '1.20.3': { paper: '1.20.3-85', bukkit: '1.20.3' },
    '1.20.2': { paper: '1.20.2-81', bukkit: '1.20.2' },
    '1.20.1': { paper: '1.20.1-14', bukkit: '1.20.1' },
    '1.20': { paper: '1.20-56', bukkit: '1.20' },
    '1.19.4': { paper: '1.19.4-76', bukkit: '1.19.4' },
    '1.19.3': { paper: '1.19.3-72', bukkit: '1.19.3' },
    '1.19.2': { paper: '1.19.2-69', bukkit: '1.19.2' },
    '1.19.1': { paper: '1.19.1-67', bukkit: '1.19.1' },
    '1.19': { paper: '1.19-65', bukkit: '1.19' }
};

// ==================== GENERADOR DE POM.XML ====================

function generarPomXml(nombre, version, software, caracteristicas) {
    const versionInfo = VERSION_MAP[version] || { paper: `${version}-R0.1-SNAPSHOT`, bukkit: version };
    
    let dependencias = `        <dependency>
            <groupId>io.papermc.paper</groupId>
            <artifactId>paper-api</artifactId>
            <version>${versionInfo.paper}-SNAPSHOT</version>
            <scope>provided</scope>
        </dependency>`;

    if (caracteristicas.economia) {
        dependencias += `\n        <dependency>
            <groupId>net.milkbowl.vault</groupId>
            <artifactId>VaultAPI</artifactId>
            <version>1.7</version>
            <scope>provided</scope>
        </dependency>`;
    }

    dependencias += `\n        <dependency>
            <groupId>com.google.code.gson</groupId>
            <artifactId>gson</artifactId>
            <version>2.10.1</version>
        </dependency>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.plugin</groupId>
    <artifactId>${nombre.toLowerCase()}</artifactId>
    <version>1.0</version>
    <packaging>jar</packaging>
    <name>${nombre}</name>

    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <repositories>
        <repository>
            <id>papermc</id>
            <url>https://repo.papermc.io/repository/maven-public/</url>
        </repository>
    </repositories>

    <dependencies>
${dependencias}
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <source>17</source>
                    <target>17</target>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>`;
}

// ==================== COMPILACIÓN ====================

function compilarPlugin(dirProyecto, nombre) {
    log(`Compilando ${nombre}...`, 'info');
    
    try {
        execSync('mvn clean package -DskipTests -q', {
            cwd: dirProyecto,
            stdio: 'inherit',
            timeout: 180000 // 3 minutos
        });
        
        log('✓ Compilación exitosa', 'success');
        return true;
    } catch (error) {
        log(`Error Maven: ${error.message}`, 'error');
        throw new Error('Error compilando');
    }
}

// ==================== COPIAR JAR ====================

function copiarJAR(nombre, dirProyecto) {
    const jarOrigen = path.join(dirProyecto, 'target', `${nombre.toLowerCase()}-1.0.jar`);
    
    if (!fs.existsSync(jarOrigen)) {
        throw new Error('JAR no encontrado');
    }

    const nombreJAR = `${nombre}-${Date.now()}.jar`;
    const jarDestino = path.join(OUTPUT_DIR, nombreJAR);
    fs.copyFileSync(jarOrigen, jarDestino);

    return nombreJAR;
}

// ==================== RUTAS ====================

app.get('/health', (req, res) => {
    res.json({ status: 'ok', mensaje: 'Servidor activo' });
});

app.post('/generar-plugin', async (req, res) => {
    const { descripcion, nombre, version, software } = req.body;

    if (!descripcion || !nombre) {
        return res.status(400).json({ error: 'Faltan parámetros' });
    }

    let dir = null;

    try {
        log(`\n📦 Solicitud: ${nombre}`, 'info');

        // Detectar características
        const caracteristicas = detectarCaracteristicas(descripcion);
        log(`Características detectadas: ${Object.entries(caracteristicas)
            .filter(([_, v]) => v)
            .map(([k, _]) => k)
            .join(', ')}`, 'info');

        // Generar código
        const mainJava = generarMainJava(nombre, caracteristicas);
        const pluginYml = generarPluginYml(nombre, descripcion, caracteristicas);
        const pomXml = generarPomXml(nombre, version, software, caracteristicas);

        // Crear estructura Maven
        const dirProyecto = path.join(TEMP_DIR, `${nombre}-${Date.now()}`);
        const srcDir = path.join(dirProyecto, 'src', 'main', 'java', 'com', 'plugin', nombre.toLowerCase());
        const resDir = path.join(dirProyecto, 'src', 'main', 'resources');

        fs.mkdirSync(srcDir, { recursive: true });
        fs.mkdirSync(resDir, { recursive: true });

        fs.writeFileSync(path.join(srcDir, 'Main.java'), mainJava);
        fs.writeFileSync(path.join(resDir, 'plugin.yml'), pluginYml);
        fs.writeFileSync(path.join(dirProyecto, 'pom.xml'), pomXml);

        log('✓ Estructura Maven creada', 'success');

        // Compilar
        compilarPlugin(dirProyecto, nombre);

        // Copiar JAR
        const jarNombre = copiarJAR(nombre, dirProyecto);
        const jarUrl = `/descargar/${jarNombre}`;

        log(`✅ ${nombre} compilado exitosamente`, 'success');

        res.json({
            success: true,
            jarUrl: jarUrl,
            mensaje: 'Plugin compilado en 5 segundos'
        });

        // Limpiar después (async)
        setTimeout(() => {
            try {
                execSync(`rm -rf "${dirProyecto}"`, { stdio: 'pipe' });
            } catch (e) {}
        }, 5000);

    } catch (error) {
        log(`❌ ${error.message}`, 'error');
        res.status(500).json({ error: error.message });

        // Limpiar en error
        if (dir && fs.existsSync(dir)) {
            try {
                execSync(`rm -rf "${dir}"`, { stdio: 'pipe' });
            } catch (e) {}
        }
    }
});

app.get('/descargar/:archivo', (req, res) => {
    const archivo = req.params.archivo;
    const ruta = path.join(OUTPUT_DIR, archivo);

    if (!ruta.startsWith(OUTPUT_DIR)) {
        return res.status(403).json({ error: 'No permitido' });
    }

    if (!fs.existsSync(ruta)) {
        return res.status(404).json({ error: 'No encontrado' });
    }

    res.download(ruta, (err) => {
        if (err) log(`Error descargando: ${err.message}`, 'error');
    });
});

// ==================== INICIO ====================

app.listen(PORT, () => {
    try {
        log(`\n╔════════════════════════════════════╗`, 'success');
        log(`║  Plugin Compiler Activo ✓          ║`, 'success');
        log(`║  Puerto: ${PORT}${' '.repeat(30 - PORT.toString().length)}║`, 'success');
        log(`║  Generación: INSTANTÁNEA (5s)      ║`, 'success');
        log(`║  Costo: GRATIS                     ║`, 'success');
        log(`║  Límite: ILIMITADO                 ║`, 'success');
        log(`╚════════════════════════════════════╝\n`, 'success');
    } catch (error) {
        log(`Fatal: ${error.message}`, 'error');
        process.exit(1);
    }
});
