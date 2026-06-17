package ai.daisyclaw.app.node

import ai.daisyclaw.app.protocol.DaisyClawCalendarCommand
import ai.daisyclaw.app.protocol.DaisyClawCallLogCommand
import ai.daisyclaw.app.protocol.DaisyClawCameraCommand
import ai.daisyclaw.app.protocol.DaisyClawCapability
import ai.daisyclaw.app.protocol.DaisyClawContactsCommand
import ai.daisyclaw.app.protocol.DaisyClawDeviceCommand
import ai.daisyclaw.app.protocol.DaisyClawLocationCommand
import ai.daisyclaw.app.protocol.DaisyClawMotionCommand
import ai.daisyclaw.app.protocol.DaisyClawNotificationsCommand
import ai.daisyclaw.app.protocol.DaisyClawPhotosCommand
import ai.daisyclaw.app.protocol.DaisyClawSmsCommand
import ai.daisyclaw.app.protocol.DaisyClawSystemCommand
import ai.daisyclaw.app.protocol.DaisyClawTalkCommand
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeCommandRegistryTest {
  private val coreCapabilities =
    setOf(
      DaisyClawCapability.Canvas.rawValue,
      DaisyClawCapability.Device.rawValue,
      DaisyClawCapability.Notifications.rawValue,
      DaisyClawCapability.System.rawValue,
      DaisyClawCapability.Talk.rawValue,
      DaisyClawCapability.Contacts.rawValue,
      DaisyClawCapability.Calendar.rawValue,
    )

  private val optionalCapabilities =
    setOf(
      DaisyClawCapability.Camera.rawValue,
      DaisyClawCapability.Location.rawValue,
      DaisyClawCapability.Sms.rawValue,
      DaisyClawCapability.CallLog.rawValue,
      DaisyClawCapability.VoiceWake.rawValue,
      DaisyClawCapability.Motion.rawValue,
      DaisyClawCapability.Photos.rawValue,
    )

  private val coreCommands =
    setOf(
      DaisyClawDeviceCommand.Status.rawValue,
      DaisyClawDeviceCommand.Info.rawValue,
      DaisyClawDeviceCommand.Permissions.rawValue,
      DaisyClawDeviceCommand.Health.rawValue,
      DaisyClawNotificationsCommand.List.rawValue,
      DaisyClawNotificationsCommand.Actions.rawValue,
      DaisyClawSystemCommand.Notify.rawValue,
      DaisyClawTalkCommand.PttStart.rawValue,
      DaisyClawTalkCommand.PttStop.rawValue,
      DaisyClawTalkCommand.PttCancel.rawValue,
      DaisyClawTalkCommand.PttOnce.rawValue,
      DaisyClawContactsCommand.Search.rawValue,
      DaisyClawContactsCommand.Add.rawValue,
      DaisyClawCalendarCommand.Events.rawValue,
      DaisyClawCalendarCommand.Add.rawValue,
    )

  private val optionalCommands =
    setOf(
      DaisyClawCameraCommand.Snap.rawValue,
      DaisyClawCameraCommand.Clip.rawValue,
      DaisyClawCameraCommand.List.rawValue,
      DaisyClawLocationCommand.Get.rawValue,
      DaisyClawMotionCommand.Activity.rawValue,
      DaisyClawMotionCommand.Pedometer.rawValue,
      DaisyClawSmsCommand.Send.rawValue,
      DaisyClawSmsCommand.Search.rawValue,
      DaisyClawCallLogCommand.Search.rawValue,
      DaisyClawPhotosCommand.Latest.rawValue,
    )

  private val debugCommands = setOf("debug.logs", "debug.ed25519")

  @Test
  fun advertisedCapabilities_respectsFeatureAvailability() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags())

    assertContainsAll(capabilities, coreCapabilities)
    assertMissingAll(capabilities, optionalCapabilities)
  }

  @Test
  fun advertisedCapabilities_includesFeatureCapabilitiesWhenEnabled() {
    val capabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          smsSearchPossible = true,
          callLogAvailable = true,
          photosAvailable = true,
          voiceWakeEnabled = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
        ),
      )

    assertContainsAll(capabilities, coreCapabilities + optionalCapabilities)
  }

  @Test
  fun advertisedCommands_respectsFeatureAvailability() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags())

    assertContainsAll(commands, coreCommands)
    assertMissingAll(commands, optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_includesDeviceAppsOnlyWhenUserOptedIn() {
    val disabled = InvokeCommandRegistry.advertisedCommands(defaultFlags(installedAppsSharingEnabled = false))
    val enabled = InvokeCommandRegistry.advertisedCommands(defaultFlags(installedAppsSharingEnabled = true))

    assertFalse(disabled.contains(DaisyClawDeviceCommand.Apps.rawValue))
    assertTrue(enabled.contains(DaisyClawDeviceCommand.Apps.rawValue))
  }

  @Test
  fun advertisedCommands_includesFeatureCommandsWhenEnabled() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          smsSearchPossible = true,
          callLogAvailable = true,
          photosAvailable = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
          debugBuild = true,
        ),
      )

    assertContainsAll(commands, coreCommands + optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_onlyIncludesSupportedMotionCommands() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        NodeRuntimeFlags(
          cameraEnabled = false,
          locationEnabled = false,
          sendSmsAvailable = false,
          readSmsAvailable = false,
          smsSearchPossible = false,
          callLogAvailable = false,
          photosAvailable = false,
          voiceWakeEnabled = false,
          motionActivityAvailable = true,
          motionPedometerAvailable = false,
          installedAppsSharingEnabled = false,
          debugBuild = false,
        ),
      )

    assertTrue(commands.contains(DaisyClawMotionCommand.Activity.rawValue))
    assertFalse(commands.contains(DaisyClawMotionCommand.Pedometer.rawValue))
  }

  @Test
  fun advertisedCommands_splitsSmsSendAndSearchAvailability() {
    val readOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(readSmsAvailable = true, smsSearchPossible = true),
      )
    val sendOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(sendSmsAvailable = true),
      )
    val requestableSearchCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(smsSearchPossible = true),
      )

    assertTrue(readOnlyCommands.contains(DaisyClawSmsCommand.Search.rawValue))
    assertFalse(readOnlyCommands.contains(DaisyClawSmsCommand.Send.rawValue))
    assertTrue(sendOnlyCommands.contains(DaisyClawSmsCommand.Send.rawValue))
    assertFalse(sendOnlyCommands.contains(DaisyClawSmsCommand.Search.rawValue))
    assertTrue(requestableSearchCommands.contains(DaisyClawSmsCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_includeSmsWhenEitherSmsPathIsAvailable() {
    val readOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(readSmsAvailable = true),
      )
    val sendOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(sendSmsAvailable = true),
      )
    val requestableSearchCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(smsSearchPossible = true),
      )

    assertTrue(readOnlyCapabilities.contains(DaisyClawCapability.Sms.rawValue))
    assertTrue(sendOnlyCapabilities.contains(DaisyClawCapability.Sms.rawValue))
    assertFalse(requestableSearchCapabilities.contains(DaisyClawCapability.Sms.rawValue))
  }

  @Test
  fun advertisedCommands_excludesCallLogWhenUnavailable() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(callLogAvailable = false))

    assertFalse(commands.contains(DaisyClawCallLogCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_excludesCallLogWhenUnavailable() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(callLogAvailable = false))

    assertFalse(capabilities.contains(DaisyClawCapability.CallLog.rawValue))
  }

  @Test
  fun advertisedPhotosSurface_respectsFeatureAvailability() {
    val disabledFlags = defaultFlags(photosAvailable = false)
    val enabledFlags = defaultFlags(photosAvailable = true)

    assertFalse(InvokeCommandRegistry.advertisedCapabilities(disabledFlags).contains(DaisyClawCapability.Photos.rawValue))
    assertFalse(InvokeCommandRegistry.advertisedCommands(disabledFlags).contains(DaisyClawPhotosCommand.Latest.rawValue))
    assertTrue(InvokeCommandRegistry.advertisedCapabilities(enabledFlags).contains(DaisyClawCapability.Photos.rawValue))
    assertTrue(InvokeCommandRegistry.advertisedCommands(enabledFlags).contains(DaisyClawPhotosCommand.Latest.rawValue))
  }

  @Test
  fun advertisedCapabilities_includesVoiceWakeWithoutAdvertisingCommands() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(voiceWakeEnabled = true))
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(voiceWakeEnabled = true))

    assertTrue(capabilities.contains(DaisyClawCapability.VoiceWake.rawValue))
    assertFalse(commands.any { it.contains("voice", ignoreCase = true) })
  }

  @Test
  fun find_returnsForegroundMetadataForCameraCommands() {
    val list = InvokeCommandRegistry.find(DaisyClawCameraCommand.List.rawValue)
    val location = InvokeCommandRegistry.find(DaisyClawLocationCommand.Get.rawValue)

    assertNotNull(list)
    assertEquals(true, list?.requiresForeground)
    assertNotNull(location)
    assertEquals(false, location?.requiresForeground)
  }

  @Test
  fun find_returnsNullForUnknownCommand() {
    assertNull(InvokeCommandRegistry.find("not.real"))
  }

  private fun defaultFlags(
    cameraEnabled: Boolean = false,
    locationEnabled: Boolean = false,
    sendSmsAvailable: Boolean = false,
    readSmsAvailable: Boolean = false,
    smsSearchPossible: Boolean = false,
    callLogAvailable: Boolean = false,
    photosAvailable: Boolean = false,
    voiceWakeEnabled: Boolean = false,
    motionActivityAvailable: Boolean = false,
    motionPedometerAvailable: Boolean = false,
    installedAppsSharingEnabled: Boolean = false,
    debugBuild: Boolean = false,
  ): NodeRuntimeFlags =
    NodeRuntimeFlags(
      cameraEnabled = cameraEnabled,
      locationEnabled = locationEnabled,
      sendSmsAvailable = sendSmsAvailable,
      readSmsAvailable = readSmsAvailable,
      smsSearchPossible = smsSearchPossible,
      callLogAvailable = callLogAvailable,
      photosAvailable = photosAvailable,
      voiceWakeEnabled = voiceWakeEnabled,
      motionActivityAvailable = motionActivityAvailable,
      motionPedometerAvailable = motionPedometerAvailable,
      installedAppsSharingEnabled = installedAppsSharingEnabled,
      debugBuild = debugBuild,
    )

  private fun assertContainsAll(
    actual: List<String>,
    expected: Set<String>,
  ) {
    expected.forEach { value -> assertTrue(actual.contains(value)) }
  }

  private fun assertMissingAll(
    actual: List<String>,
    forbidden: Set<String>,
  ) {
    forbidden.forEach { value -> assertFalse(actual.contains(value)) }
  }
}
