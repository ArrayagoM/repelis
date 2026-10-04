// Extiende app.json: en CI el número de build sube solo, así cada APK/IPA nuevo se instala como actualización.
module.exports = ({ config }) => {
  const build = Number(process.env.BUILD_NUMBER) || 1
  return {
    ...config,
    ios: { ...config.ios, buildNumber: String(build) },
    android: { ...config.android, versionCode: build },
  }
}
