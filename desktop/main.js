const { app, BrowserWindow, Menu, session, shell } = require('electron')
const path = require('path')

const APP_URL = process.env.LIFEHIGH_URL || 'https://repelis.vercel.app'
const SMOKE = process.env.LIFEHIGH_SMOKE === '1'
const APP_ORIGIN = new URL(APP_URL).origin

// Algunos embeds rechazan user agents con "Electron/x": mostramos el de Chrome puro.
app.userAgentFallback = app.userAgentFallback
  .replace(/ Electron\/[\d.]+/, '')
  .replace(/ lifehigh-desktop\/[\d.]+/, '')

if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit()
}

let win = null

const createWindow = () => {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 560,
    backgroundColor: '#08080E',
    title: 'Life High',
    icon: path.join(__dirname, 'build', 'icon.png'),
    show: !SMOKE,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
    },
  })

  // Los popups (anuncios de los servidores de video) se bloquean; los enlaces http(s) legítimos del sitio se abren en el navegador.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // La página principal solo puede navegar dentro del sitio; redirecciones de anuncios a otros dominios se cancelan.
  win.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== APP_ORIGIN) {
      event.preventDefault()
      if (/^https?:/.test(url)) shell.openExternal(url)
    }
  })

  win.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
    if (!isMainFrame || code === -3) return // -3 = navegación cancelada (normal)
    if (SMOKE) {
      console.log(`SMOKE_FAIL ${code} ${description}`)
      app.exit(1)
      return
    }
    win.loadFile(path.join(__dirname, 'offline.html'), { query: { url: APP_URL } })
  })

  if (SMOKE) {
    win.webContents.on('did-finish-load', async () => {
      const title = await win.webContents.executeJavaScript('document.title')
      console.log(`SMOKE_OK ${win.webContents.getURL()} | ${title}`)
      app.exit(0)
    })
    setTimeout(() => {
      console.log('SMOKE_TIMEOUT')
      app.exit(2)
    }, 45000)
  }

  win.loadURL(APP_URL)
  win.on('closed', () => {
    win = null
  })
}

app.whenReady().then(() => {
  // Pantalla completa y reproducción de media permitidas; el resto de permisos se deniega.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['fullscreen', 'media', 'pointerLock'].includes(permission))
  })

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { label: 'Ver', submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] },
      { label: 'Ventana', submenu: [{ role: 'minimize' }, { role: 'close' }] },
    ]),
  )

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
