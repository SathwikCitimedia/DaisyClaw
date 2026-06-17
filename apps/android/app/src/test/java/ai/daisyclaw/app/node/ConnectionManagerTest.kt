package ai.daisyclaw.app.node

import ai.daisyclaw.app.LocationMode
import ai.daisyclaw.app.SecurePrefs
import ai.daisyclaw.app.VoiceWakeMode
import ai.daisyclaw.app.gateway.GatewayEndpoint
import ai.daisyclaw.app.gateway.isLocalCleartextGatewayHost
import ai.daisyclaw.app.gateway.isLoopbackGatewayHost
import ai.daisyclaw.app.protocol.DaisyClawCallLogCommand
import ai.daisyclaw.app.protocol.DaisyClawCameraCommand
import ai.daisyclaw.app.protocol.DaisyClawCapability
import ai.daisyclaw.app.protocol.DaisyClawDeviceCommand
import ai.daisyclaw.app.protocol.DaisyClawLocationCommand
import ai.daisyclaw.app.protocol.DaisyClawMotionCommand
import ai.daisyclaw.app.protocol.DaisyClawPhotosCommand
import ai.daisyclaw.app.protocol.DaisyClawSmsCommand
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment

@RunWith(RobolectricTestRunner::class)
class ConnectionManagerTest {
  @Test
  fun resolveTlsParamsForEndpoint_prefersStoredPinOverAdvertisedFingerprint() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_daisyclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "10.0.0.2",
        port = 18789,
        tlsEnabled = true,
        tlsFingerprintSha256 = "attacker",
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = "legit",
        manualTlsEnabled = false,
      )

    assertEquals("legit", params?.expectedFingerprint)
    assertEquals(false, params?.allowTOFU)
  }

  @Test
  fun resolveTlsParamsForEndpoint_doesNotTrustAdvertisedFingerprintWhenNoStoredPin() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_daisyclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "10.0.0.2",
        port = 18789,
        tlsEnabled = true,
        tlsFingerprintSha256 = "attacker",
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertNull(params?.expectedFingerprint)
    assertEquals(false, params?.allowTOFU)
  }

  @Test
  fun resolveTlsParamsForEndpoint_manualRespectsManualTlsToggle() {
    val endpoint = GatewayEndpoint.manual(host = "127.0.0.1", port = 443)

    val off =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )
    assertNull(off)

    val on =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = true,
      )
    assertNull(on?.expectedFingerprint)
    assertEquals(false, on?.allowTOFU)
  }

  @Test
  fun resolveTlsParamsForEndpoint_manualNonLoopbackForcesTlsWhenToggleIsOff() {
    val endpoint = GatewayEndpoint.manual(host = "example.com", port = 443)

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertEquals(true, params?.required)
    assertNull(params?.expectedFingerprint)
    assertEquals(false, params?.allowTOFU)
  }

  @Test
  fun resolveTlsParamsForEndpoint_manualPrivateLanRespectsManualTlsToggle() {
    val endpoint = GatewayEndpoint.manual(host = "192.168.1.20", port = 18789)

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertNull(params)
  }

  @Test
  fun resolveTlsParamsForEndpoint_manualPrivateLanCleartextCanOverrideStoredPin() {
    val endpoint = GatewayEndpoint.manual(host = "192.168.1.20", port = 18789)

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = "pinned",
        manualTlsEnabled = false,
      )

    assertNull(params)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryTailnetWithoutHintsStillRequiresTls() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_daisyclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "100.64.0.9",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertEquals(true, params?.required)
    assertNull(params?.expectedFingerprint)
    assertEquals(false, params?.allowTOFU)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryPrivateLanWithoutHintsStillRequiresTls() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_daisyclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "192.168.1.20",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertEquals(true, params?.required)
    assertNull(params?.expectedFingerprint)
    assertEquals(false, params?.allowTOFU)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryLoopbackWithoutHintsCanStayCleartext() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_daisyclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "127.0.0.1",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertNull(params)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryLocalhostWithoutHintsCanStayCleartext() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_daisyclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "localhost",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertNull(params)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryAndroidEmulatorWithoutHintsCanStayCleartext() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_daisyclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "10.0.2.2",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertNull(params)
  }

  @Test
  fun isLoopbackGatewayHost_onlyTreatsEmulatorBridgeAsLocalWhenAllowed() {
    assertTrue(isLoopbackGatewayHost("10.0.2.2", allowEmulatorBridgeAlias = true))
    assertFalse(isLoopbackGatewayHost("10.0.2.2", allowEmulatorBridgeAlias = false))
  }

  @Test
  fun isLocalCleartextGatewayHost_acceptsLanIpsButRejectsMdnsAndTailnetHosts() {
    assertTrue(isLocalCleartextGatewayHost("192.168.1.20"))
    assertFalse(isLocalCleartextGatewayHost("gateway.local"))
    assertFalse(isLocalCleartextGatewayHost("100.64.0.9"))
    assertFalse(isLocalCleartextGatewayHost("gateway.tailnet.ts.net"))
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryIpv6LoopbackWithoutHintsCanStayCleartext() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_daisyclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "::1",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertNull(params)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryMappedIpv4LoopbackWithoutHintsCanStayCleartext() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_daisyclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "::ffff:127.0.0.1",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertNull(params)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryNonLoopbackIpv6WithoutHintsRequiresTls() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_daisyclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "2001:db8::1",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertEquals(true, params?.required)
    assertNull(params?.expectedFingerprint)
    assertEquals(false, params?.allowTOFU)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryUnspecifiedIpv4WithoutHintsRequiresTls() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_daisyclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "0.0.0.0",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertEquals(true, params?.required)
    assertNull(params?.expectedFingerprint)
    assertEquals(false, params?.allowTOFU)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryUnspecifiedIpv6WithoutHintsRequiresTls() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_daisyclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "::",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertEquals(true, params?.required)
    assertNull(params?.expectedFingerprint)
    assertEquals(false, params?.allowTOFU)
  }

  @Test
  fun buildOperatorConnectOptions_requestsQrBootstrapHandoffScopes() {
    val options = newManager().buildOperatorConnectOptions()

    assertEquals(
      listOf(
        "operator.approvals",
        "operator.read",
        "operator.write",
      ),
      options.scopes,
    )
  }

  @Test
  fun buildNodeConnectOptions_advertisesRequestableSmsSearchWithoutSmsCapability() {
    val options =
      newManager(
        sendSmsAvailable = false,
        readSmsAvailable = false,
        smsSearchPossible = true,
      ).buildNodeConnectOptions()

    assertTrue(options.commands.contains(DaisyClawSmsCommand.Search.rawValue))
    assertFalse(options.commands.contains(DaisyClawSmsCommand.Send.rawValue))
    assertFalse(options.caps.contains(DaisyClawCapability.Sms.rawValue))
  }

  @Test
  fun buildNodeConnectOptions_doesNotAdvertiseSmsWhenSearchIsImpossible() {
    val options =
      newManager(
        sendSmsAvailable = false,
        readSmsAvailable = false,
        smsSearchPossible = false,
      ).buildNodeConnectOptions()

    assertFalse(options.commands.contains(DaisyClawSmsCommand.Search.rawValue))
    assertFalse(options.commands.contains(DaisyClawSmsCommand.Send.rawValue))
    assertFalse(options.caps.contains(DaisyClawCapability.Sms.rawValue))
  }

  @Test
  fun buildNodeConnectOptions_advertisesSmsCapabilityWhenReadSmsIsAvailable() {
    val options =
      newManager(
        sendSmsAvailable = false,
        readSmsAvailable = true,
        smsSearchPossible = true,
      ).buildNodeConnectOptions()

    assertTrue(options.commands.contains(DaisyClawSmsCommand.Search.rawValue))
    assertTrue(options.caps.contains(DaisyClawCapability.Sms.rawValue))
  }

  @Test
  fun buildNodeConnectOptions_advertisesSmsSendWithoutSearchWhenOnlySendIsAvailable() {
    val options =
      newManager(
        sendSmsAvailable = true,
        readSmsAvailable = false,
        smsSearchPossible = false,
      ).buildNodeConnectOptions()

    assertTrue(options.commands.contains(DaisyClawSmsCommand.Send.rawValue))
    assertFalse(options.commands.contains(DaisyClawSmsCommand.Search.rawValue))
    assertTrue(options.caps.contains(DaisyClawCapability.Sms.rawValue))
  }

  @Test
  fun buildNodeConnectOptions_advertisesAvailableNonSmsCommandsAndCapabilities() {
    val options =
      newManager(
        cameraEnabled = true,
        locationMode = LocationMode.WhileUsing,
        voiceWakeMode = VoiceWakeMode.Always,
        motionActivityAvailable = true,
        callLogAvailable = true,
        photosAvailable = true,
        hasRecordAudioPermission = true,
      ).buildNodeConnectOptions()

    assertTrue(options.commands.contains(DaisyClawCameraCommand.List.rawValue))
    assertTrue(options.commands.contains(DaisyClawLocationCommand.Get.rawValue))
    assertTrue(options.commands.contains(DaisyClawMotionCommand.Activity.rawValue))
    assertTrue(options.commands.contains(DaisyClawCallLogCommand.Search.rawValue))
    assertTrue(options.commands.contains(DaisyClawPhotosCommand.Latest.rawValue))
    assertTrue(options.caps.contains(DaisyClawCapability.Camera.rawValue))
    assertTrue(options.caps.contains(DaisyClawCapability.Location.rawValue))
    assertTrue(options.caps.contains(DaisyClawCapability.Motion.rawValue))
    assertTrue(options.caps.contains(DaisyClawCapability.CallLog.rawValue))
    assertTrue(options.caps.contains(DaisyClawCapability.Photos.rawValue))
    assertTrue(options.caps.contains(DaisyClawCapability.VoiceWake.rawValue))
  }

  @Test
  fun buildNodeConnectOptions_advertisesDeviceAppsOnlyWhenUserOptedIn() {
    val disabled = newManager(installedAppsSharingEnabled = false).buildNodeConnectOptions()
    val enabled = newManager(installedAppsSharingEnabled = true).buildNodeConnectOptions()

    assertFalse(disabled.commands.contains(DaisyClawDeviceCommand.Apps.rawValue))
    assertTrue(enabled.commands.contains(DaisyClawDeviceCommand.Apps.rawValue))
  }

  @Test
  fun buildNodeConnectOptions_omitsVoiceWakeWithoutMicrophonePermission() {
    val options =
      newManager(
        voiceWakeMode = VoiceWakeMode.Always,
        hasRecordAudioPermission = false,
      ).buildNodeConnectOptions()

    assertFalse(options.caps.contains(DaisyClawCapability.VoiceWake.rawValue))
  }

  @Test
  fun buildNodeConnectOptions_omitsUnavailableCameraLocationCallLogAndPhotosSurfaces() {
    val options =
      newManager(
        cameraEnabled = false,
        locationMode = LocationMode.Off,
        callLogAvailable = false,
        photosAvailable = false,
      ).buildNodeConnectOptions()

    assertFalse(options.commands.contains(DaisyClawCameraCommand.List.rawValue))
    assertFalse(options.commands.contains(DaisyClawCameraCommand.Snap.rawValue))
    assertFalse(options.commands.contains(DaisyClawCameraCommand.Clip.rawValue))
    assertFalse(options.commands.contains(DaisyClawLocationCommand.Get.rawValue))
    assertFalse(options.commands.contains(DaisyClawCallLogCommand.Search.rawValue))
    assertFalse(options.commands.contains(DaisyClawPhotosCommand.Latest.rawValue))
    assertFalse(options.caps.contains(DaisyClawCapability.Camera.rawValue))
    assertFalse(options.caps.contains(DaisyClawCapability.Location.rawValue))
    assertFalse(options.caps.contains(DaisyClawCapability.CallLog.rawValue))
    assertFalse(options.caps.contains(DaisyClawCapability.Photos.rawValue))
  }

  @Test
  fun buildNodeConnectOptions_advertisesOnlyAvailableMotionCommand() {
    val options =
      newManager(
        motionActivityAvailable = false,
        motionPedometerAvailable = true,
      ).buildNodeConnectOptions()

    assertFalse(options.commands.contains(DaisyClawMotionCommand.Activity.rawValue))
    assertTrue(options.commands.contains(DaisyClawMotionCommand.Pedometer.rawValue))
    assertTrue(options.caps.contains(DaisyClawCapability.Motion.rawValue))
  }

  @Test
  fun buildNodeConnectOptions_omitsMotionSurfaceWhenMotionApisUnavailable() {
    val options =
      newManager(
        motionActivityAvailable = false,
        motionPedometerAvailable = false,
      ).buildNodeConnectOptions()

    assertFalse(options.commands.contains(DaisyClawMotionCommand.Activity.rawValue))
    assertFalse(options.commands.contains(DaisyClawMotionCommand.Pedometer.rawValue))
    assertFalse(options.caps.contains(DaisyClawCapability.Motion.rawValue))
  }

  private fun newManager(
    cameraEnabled: Boolean = false,
    locationMode: LocationMode = LocationMode.Off,
    voiceWakeMode: VoiceWakeMode = VoiceWakeMode.Off,
    motionActivityAvailable: Boolean = false,
    motionPedometerAvailable: Boolean = false,
    sendSmsAvailable: Boolean = false,
    readSmsAvailable: Boolean = false,
    smsSearchPossible: Boolean = false,
    callLogAvailable: Boolean = false,
    photosAvailable: Boolean = false,
    hasRecordAudioPermission: Boolean = false,
    installedAppsSharingEnabled: Boolean = false,
  ): ConnectionManager {
    val context = RuntimeEnvironment.getApplication()
    val prefs =
      SecurePrefs(
        context,
        securePrefsOverride = context.getSharedPreferences("connection-manager-test", android.content.Context.MODE_PRIVATE),
      )

    return ConnectionManager(
      prefs = prefs,
      cameraEnabled = { cameraEnabled },
      locationMode = { locationMode },
      voiceWakeMode = { voiceWakeMode },
      motionActivityAvailable = { motionActivityAvailable },
      motionPedometerAvailable = { motionPedometerAvailable },
      sendSmsAvailable = { sendSmsAvailable },
      readSmsAvailable = { readSmsAvailable },
      smsSearchPossible = { smsSearchPossible },
      callLogAvailable = { callLogAvailable },
      photosAvailable = { photosAvailable },
      hasRecordAudioPermission = { hasRecordAudioPermission },
      installedAppsSharingEnabled = { installedAppsSharingEnabled },
      manualTls = { false },
    )
  }
}
