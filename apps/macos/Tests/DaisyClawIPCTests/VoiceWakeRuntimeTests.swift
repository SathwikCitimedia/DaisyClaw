import Foundation
import SwabbleKit
import Testing
@testable import DaisyClaw

struct VoiceWakeRuntimeTests {
    @Test func `trims after trigger keeps post speech`() {
        let triggers = ["claude", "daisyclaw"]
        let text = "hey Claude how are you"
        #expect(VoiceWakeRuntime._testTrimmedAfterTrigger(text, triggers: triggers) == "how are you")
    }

    @Test func `trims after trigger returns original when no trigger`() {
        let triggers = ["claude"]
        let text = "good morning friend"
        #expect(VoiceWakeRuntime._testTrimmedAfterTrigger(text, triggers: triggers) == text)
    }

    @Test func `trims after first matching trigger`() {
        let triggers = ["buddy", "claude"]
        let text = "hello buddy this is after trigger claude also here"
        #expect(VoiceWakeRuntime
            ._testTrimmedAfterTrigger(text, triggers: triggers) == "this is after trigger claude also here")
    }

    @Test func `has content after trigger false when only trigger`() {
        let triggers = ["daisyclaw"]
        let text = "hey daisyclaw"
        #expect(!VoiceWakeRuntime._testHasContentAfterTrigger(text, triggers: triggers))
    }

    @Test func `has content after trigger true when speech continues`() {
        let triggers = ["claude"]
        let text = "claude write a note"
        #expect(VoiceWakeRuntime._testHasContentAfterTrigger(text, triggers: triggers))
    }

    @Test func `trigger only allows filler before trigger`() {
        let triggers = ["daisyclaw"]
        let text = "uh daisyclaw"
        #expect(VoiceWakeRuntime._testIsTriggerOnly(text, triggers: triggers))
    }

    @Test func `trigger only rejects trailing wake word mentions in ordinary speech`() {
        let triggers = ["daisyclaw"]
        let text = "tell me about daisyclaw"
        #expect(!VoiceWakeRuntime._testIsTriggerOnly(text, triggers: triggers))
    }

    @Test func `matched trigger finds trigger not at transcript start`() {
        let triggers = ["daisyclaw"]
        let text = "uh daisyclaw"
        #expect(VoiceWakeRuntime._testMatchedTriggerWord(text, triggers: triggers) == "daisyclaw")
    }

    @Test func `matched trigger rejects larger word suffix matches`() {
        let triggers = ["computer"]
        let text = "uh computers"
        #expect(VoiceWakeRuntime._testMatchedTriggerWord(text, triggers: triggers) == nil)
    }

    @Test func `matched trigger prefers most specific overlapping phrase`() {
        let triggers = ["daisyclaw", "hey daisyclaw"]
        let text = "hey daisyclaw"
        #expect(VoiceWakeRuntime._testMatchedTriggerWord(text, triggers: triggers) == "hey daisyclaw")
    }

    @Test func `matched trigger handles width insensitive forms without whitespace tokens`() {
        let triggers = ["daisyclaw"]
        let text = "ＯｐｅｎＣｌａｗ"
        #expect(VoiceWakeRuntime._testMatchedTriggerWord(text, triggers: triggers) == "daisyclaw")
    }

    @Test func `matched trigger handles chinese forms without whitespace tokens`() {
        let triggers = ["小爪"]
        let text = "嘿小爪"
        #expect(VoiceWakeRuntime._testMatchedTriggerWord(text, triggers: triggers) == "小爪")
    }

    @Test func `text only fallback populates matched trigger`() {
        let transcript = "hey daisyclaw do thing"
        let config = WakeWordGateConfig(triggers: ["daisyclaw"], minCommandLength: 1)
        let match = VoiceWakeRecognitionDebugSupport.textOnlyFallbackMatch(
            transcript: transcript,
            triggers: ["daisyclaw"],
            config: config,
            trimWake: VoiceWakeRuntime._testTrimmedAfterTrigger)
        #expect(match?.trigger == "daisyclaw")
    }

    @Test func `text only fallback keeps the first trigger phrase when later words match another trigger`() {
        let transcript = "daisyclaw tell me about computer vision"
        let config = WakeWordGateConfig(triggers: ["daisyclaw", "computer"], minCommandLength: 1)
        let match = VoiceWakeRecognitionDebugSupport.textOnlyFallbackMatch(
            transcript: transcript,
            triggers: ["daisyclaw", "computer"],
            config: config,
            trimWake: VoiceWakeRuntime._testTrimmedAfterTrigger)
        #expect(match?.trigger == "daisyclaw")
    }

    @Test func `text only fallback rejects filler prefixed larger word suffix matches`() {
        let transcript = "uh computers"
        let config = WakeWordGateConfig(triggers: ["computer"], minCommandLength: 1)
        let match = VoiceWakeRecognitionDebugSupport.textOnlyFallbackMatch(
            transcript: transcript,
            triggers: ["computer"],
            config: config,
            trimWake: VoiceWakeRuntime._testTrimmedAfterTrigger)
        #expect(match == nil)
    }

    @Test func `trims after chinese trigger keeps post speech`() {
        let triggers = ["小爪", "daisyclaw"]
        let text = "嘿 小爪 帮我打开设置"
        #expect(VoiceWakeRuntime._testTrimmedAfterTrigger(text, triggers: triggers) == "帮我打开设置")
    }

    @Test func `trims after trigger handles width insensitive forms`() {
        let triggers = ["daisyclaw"]
        let text = "ＯｐｅｎＣｌａｗ 请帮我"
        #expect(VoiceWakeRuntime._testTrimmedAfterTrigger(text, triggers: triggers) == "请帮我")
    }

    @Test func `gate requires gap between trigger and command`() {
        let transcript = "hey daisyclaw do thing"
        let segments = makeWakeWordSegments(
            transcript: transcript,
            words: [
                ("hey", 0.0, 0.1),
                ("daisyclaw", 0.2, 0.1),
                ("do", 0.35, 0.1),
                ("thing", 0.5, 0.1),
            ])
        let config = WakeWordGateConfig(triggers: ["daisyclaw"], minPostTriggerGap: 0.3)
        #expect(WakeWordGate.match(transcript: transcript, segments: segments, config: config) == nil)
    }

    @Test func `gate accepts gap and extracts command`() {
        let transcript = "hey daisyclaw do thing"
        let segments = makeWakeWordSegments(
            transcript: transcript,
            words: [
                ("hey", 0.0, 0.1),
                ("daisyclaw", 0.2, 0.1),
                ("do", 0.9, 0.1),
                ("thing", 1.1, 0.1),
            ])
        let config = WakeWordGateConfig(triggers: ["daisyclaw"], minPostTriggerGap: 0.3)
        #expect(WakeWordGate.match(transcript: transcript, segments: segments, config: config)?.command == "do thing")
    }

    @Test func `gate command text handles foreign string ranges`() {
        let transcript = "hey daisyclaw do thing"
        let other = "do thing"
        let foreignRange = other.range(of: "do")
        let segments = [
            WakeWordSegment(text: "hey", start: 0.0, duration: 0.1, range: transcript.range(of: "hey")),
            WakeWordSegment(text: "daisyclaw", start: 0.2, duration: 0.1, range: transcript.range(of: "daisyclaw")),
            WakeWordSegment(text: "do", start: 0.9, duration: 0.1, range: foreignRange),
            WakeWordSegment(text: "thing", start: 1.1, duration: 0.1, range: nil),
        ]

        #expect(
            WakeWordGate.commandText(
                transcript: transcript,
                segments: segments,
                triggerEndTime: 0.3) == "do thing")
    }
}
