package ai.daisyclaw.app.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class DaisyClawProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", DaisyClawCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", DaisyClawCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", DaisyClawCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", DaisyClawCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", DaisyClawCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", DaisyClawCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", DaisyClawCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", DaisyClawCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", DaisyClawCapability.Canvas.rawValue)
    assertEquals("camera", DaisyClawCapability.Camera.rawValue)
    assertEquals("voiceWake", DaisyClawCapability.VoiceWake.rawValue)
    assertEquals("talk", DaisyClawCapability.Talk.rawValue)
    assertEquals("location", DaisyClawCapability.Location.rawValue)
    assertEquals("sms", DaisyClawCapability.Sms.rawValue)
    assertEquals("device", DaisyClawCapability.Device.rawValue)
    assertEquals("notifications", DaisyClawCapability.Notifications.rawValue)
    assertEquals("system", DaisyClawCapability.System.rawValue)
    assertEquals("photos", DaisyClawCapability.Photos.rawValue)
    assertEquals("contacts", DaisyClawCapability.Contacts.rawValue)
    assertEquals("calendar", DaisyClawCapability.Calendar.rawValue)
    assertEquals("motion", DaisyClawCapability.Motion.rawValue)
    assertEquals("callLog", DaisyClawCapability.CallLog.rawValue)
  }

  @Test
  fun cameraCommandsUseStableStrings() {
    assertEquals("camera.list", DaisyClawCameraCommand.List.rawValue)
    assertEquals("camera.snap", DaisyClawCameraCommand.Snap.rawValue)
    assertEquals("camera.clip", DaisyClawCameraCommand.Clip.rawValue)
  }

  @Test
  fun notificationsCommandsUseStableStrings() {
    assertEquals("notifications.list", DaisyClawNotificationsCommand.List.rawValue)
    assertEquals("notifications.actions", DaisyClawNotificationsCommand.Actions.rawValue)
  }

  @Test
  fun deviceCommandsUseStableStrings() {
    assertEquals("device.status", DaisyClawDeviceCommand.Status.rawValue)
    assertEquals("device.info", DaisyClawDeviceCommand.Info.rawValue)
    assertEquals("device.permissions", DaisyClawDeviceCommand.Permissions.rawValue)
    assertEquals("device.health", DaisyClawDeviceCommand.Health.rawValue)
    assertEquals("device.apps", DaisyClawDeviceCommand.Apps.rawValue)
  }

  @Test
  fun systemCommandsUseStableStrings() {
    assertEquals("system.notify", DaisyClawSystemCommand.Notify.rawValue)
  }

  @Test
  fun photosCommandsUseStableStrings() {
    assertEquals("photos.latest", DaisyClawPhotosCommand.Latest.rawValue)
  }

  @Test
  fun contactsCommandsUseStableStrings() {
    assertEquals("contacts.search", DaisyClawContactsCommand.Search.rawValue)
    assertEquals("contacts.add", DaisyClawContactsCommand.Add.rawValue)
  }

  @Test
  fun calendarCommandsUseStableStrings() {
    assertEquals("calendar.events", DaisyClawCalendarCommand.Events.rawValue)
    assertEquals("calendar.add", DaisyClawCalendarCommand.Add.rawValue)
  }

  @Test
  fun motionCommandsUseStableStrings() {
    assertEquals("motion.activity", DaisyClawMotionCommand.Activity.rawValue)
    assertEquals("motion.pedometer", DaisyClawMotionCommand.Pedometer.rawValue)
  }

  @Test
  fun smsCommandsUseStableStrings() {
    assertEquals("sms.send", DaisyClawSmsCommand.Send.rawValue)
    assertEquals("sms.search", DaisyClawSmsCommand.Search.rawValue)
  }

  @Test
  fun talkCommandsUseStableStrings() {
    assertEquals("talk.ptt.start", DaisyClawTalkCommand.PttStart.rawValue)
    assertEquals("talk.ptt.stop", DaisyClawTalkCommand.PttStop.rawValue)
    assertEquals("talk.ptt.cancel", DaisyClawTalkCommand.PttCancel.rawValue)
    assertEquals("talk.ptt.once", DaisyClawTalkCommand.PttOnce.rawValue)
  }

  @Test
  fun callLogCommandsUseStableStrings() {
    assertEquals("callLog.search", DaisyClawCallLogCommand.Search.rawValue)
  }
}
