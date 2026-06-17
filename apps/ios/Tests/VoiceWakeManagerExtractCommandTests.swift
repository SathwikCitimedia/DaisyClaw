import Foundation
import SwabbleKit
import Testing
@testable import DaisyClaw

private let daisyclawTranscript = "hey daisyclaw do thing"

private func daisyclawSegments(postTriggerStart: TimeInterval) -> [WakeWordSegment] {
    makeSegments(
        transcript: daisyclawTranscript,
        words: [
            ("hey", 0.0, 0.1),
            ("daisyclaw", 0.2, 0.1),
            ("do", postTriggerStart, 0.1),
            ("thing", postTriggerStart + 0.2, 0.1),
        ])
}

@Suite struct VoiceWakeManagerExtractCommandTests {
    @Test func extractCommandReturnsNilWhenNoTriggerFound() {
        let transcript = "hello world"
        let segments = makeSegments(
            transcript: transcript,
            words: [("hello", 0.0, 0.1), ("world", 0.2, 0.1)])
        #expect(VoiceWakeManager.extractCommand(from: transcript, segments: segments, triggers: ["daisyclaw"]) == nil)
    }

    @Test func extractCommandTrimsTokensAndResult() {
        let segments = daisyclawSegments(postTriggerStart: 0.9)
        let cmd = VoiceWakeManager.extractCommand(
            from: daisyclawTranscript,
            segments: segments,
            triggers: ["  daisyclaw  "],
            minPostTriggerGap: 0.3)
        #expect(cmd == "do thing")
    }

    @Test func extractCommandReturnsNilWhenGapTooShort() {
        let segments = daisyclawSegments(postTriggerStart: 0.35)
        let cmd = VoiceWakeManager.extractCommand(
            from: daisyclawTranscript,
            segments: segments,
            triggers: ["daisyclaw"],
            minPostTriggerGap: 0.3)
        #expect(cmd == nil)
    }

    @Test func extractCommandReturnsNilWhenNothingAfterTrigger() {
        let transcript = "hey daisyclaw"
        let segments = makeSegments(
            transcript: transcript,
            words: [("hey", 0.0, 0.1), ("daisyclaw", 0.2, 0.1)])
        #expect(VoiceWakeManager.extractCommand(from: transcript, segments: segments, triggers: ["daisyclaw"]) == nil)
    }

    @Test func extractCommandIgnoresEmptyTriggers() {
        let segments = daisyclawSegments(postTriggerStart: 0.9)
        let cmd = VoiceWakeManager.extractCommand(
            from: daisyclawTranscript,
            segments: segments,
            triggers: ["", "   ", "daisyclaw"],
            minPostTriggerGap: 0.3)
        #expect(cmd == "do thing")
    }
}

private func makeSegments(
    transcript: String,
    words: [(String, TimeInterval, TimeInterval)])
-> [WakeWordSegment] {
    var searchStart = transcript.startIndex
    var output: [WakeWordSegment] = []
    for (word, start, duration) in words {
        let range = transcript.range(of: word, range: searchStart..<transcript.endIndex)
        output.append(WakeWordSegment(text: word, start: start, duration: duration, range: range))
        if let range { searchStart = range.upperBound }
    }
    return output
}
