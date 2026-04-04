/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import Foundation

struct LLMClient {
    enum Error: Swift.Error, LocalizedError {
        case invalidBaseURL
        case invalidResponse
        case missingContent
        case malformedJSONPayload

        var errorDescription: String? {
            switch self {
            case .invalidBaseURL:
                return "AI baseURL 无效"
            case .invalidResponse:
                return "AI 返回结构不合法"
            case .missingContent:
                return "AI 未返回可解析内容"
            case .malformedJSONPayload:
                return "AI 返回内容不是有效 JSON"
            }
        }
    }

    let configuration: AIConfiguration

    func generatePrototypeSpec(
        prompt: String,
        session: URLSession = .shared
    ) async throws -> AIPrototypeSpec {
        let request = try makeRequest(prompt: prompt)
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200 ..< 300).contains(httpResponse.statusCode) else {
            throw Error.invalidResponse
        }
        return try decodeSpec(from: data)
    }

    func makeRequest(prompt: String) throws -> URLRequest {
        guard let url = URL(string: configuration.baseURL)?
            .appending(path: "chat")
            .appending(path: "completions")
        else {
            throw Error.invalidBaseURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue("Bearer \(configuration.apiKey)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(
            ChatCompletionRequest(
                model: configuration.model,
                messages: [
                    .init(role: "system", content: Self.systemPrompt),
                    .init(role: "user", content: prompt)
                ],
                temperature: 0,
                responseFormat: .init(type: "json_object")
            )
        )
        return request
    }

    func decodeSpec(from data: Data) throws -> AIPrototypeSpec {
        let response = try JSONDecoder().decode(ChatCompletionResponse.self, from: data)
        guard let choice = response.choices.first else {
            throw Error.invalidResponse
        }

        let content: String? = switch choice.message.content {
        case .string(let value):
            value
        case .parts(let parts):
            parts.compactMap(\.text).joined()
        case .none:
            nil
        }

        guard let content, let contentData = content.data(using: String.Encoding.utf8) else {
            throw Error.missingContent
        }

        let payload = try extractJSONObject(from: contentData)
        return try JSONDecoder.projectDecoder.decode(AIPrototypeSpec.self, from: payload)
    }

    func extractJSONObject(from data: Data) throws -> Data {
        guard let content = String(data: data, encoding: .utf8) else {
            throw Error.malformedJSONPayload
        }

        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        if let direct = trimmed.data(using: .utf8), (try? JSONSerialization.jsonObject(with: direct)) != nil {
            return direct
        }

        let unfenced = trimmed
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if let direct = unfenced.data(using: .utf8), (try? JSONSerialization.jsonObject(with: direct)) != nil {
            return direct
        }

        guard
            let start = unfenced.firstIndex(of: "{"),
            let end = unfenced.lastIndex(of: "}"),
            start <= end
        else {
            throw Error.malformedJSONPayload
        }

        let slice = String(unfenced[start ... end])
        guard let json = slice.data(using: .utf8), (try? JSONSerialization.jsonObject(with: json)) != nil else {
            throw Error.malformedJSONPayload
        }
        return json
    }

    static let systemPrompt = """
    你是 macOS 原型生成器的布局编排器。
    你必须只输出 JSON，不允许输出解释文字、Markdown 或代码块。
    输出必须满足以下 schema：
    {
      "pages": [
        {
          "name": "页面名",
          "elements": [
            {
              "id": "唯一字符串",
              "type": "rectangle|ellipse|line|text",
              "semanticName": "语义名称",
              "x": 0,
              "y": 0,
              "width": 120,
              "height": 48,
              "text": "可选文本",
              "semanticLabelVisible": true,
              "style": {
                "fill": {"red": 1, "green": 1, "blue": 1, "alpha": 1},
                "stroke": {"red": 0, "green": 0, "blue": 0, "alpha": 1},
                "strokeWidth": 1,
                "cornerRadius": 8,
                "opacity": 1,
                "textColor": {"red": 0, "green": 0, "blue": 0, "alpha": 1},
                "fontSize": 14,
                "fontWeight": "regular|medium|semibold|bold",
                "arrowHead": false
              },
              "states": [
                {
                  "name": "状态名",
                  "text": "可选文本",
                  "style": {},
                  "width": 120,
                  "height": 48
                }
              ]
            }
          ]
        }
      ],
      "interactions": [
        {
          "sourceElementID": "元素ID",
          "sourcePageName": "源页面名",
          "trigger": "tap|longPress|hover",
          "action": "navigate|goBack|toggleState",
          "targetScreenName": "目标页面名",
          "targetStateName": "目标状态名",
          "transition": "none|slideFromRight|slideFromBottom|crossFade"
        }
      ]
    }
    要求：
    1. 页面名和语义名称必须是中文。
    2. 所有可点击控件都要有 semanticName。
    3. 有跳转需求时必须在 interactions 中声明。
    4. 坐标和尺寸必须是数字，单位为画布点。
    """
}

private struct ChatCompletionRequest: Encodable {
    struct Message: Encodable {
        var role: String
        var content: String
    }

    struct ResponseFormat: Encodable {
        var type: String
    }

    var model: String
    var messages: [Message]
    var temperature: Double
    var responseFormat: ResponseFormat

    enum CodingKeys: String, CodingKey {
        case model
        case messages
        case temperature
        case responseFormat = "response_format"
    }
}

private struct ChatCompletionResponse: Decodable {
    struct Choice: Decodable {
        struct Message: Decodable {
            enum Content: Decodable {
                struct Part: Decodable {
                    var text: String?
                }

                case string(String)
                case parts([Part])

                init(from decoder: Decoder) throws {
                    let singleValue = try decoder.singleValueContainer()
                    if let stringValue = try? singleValue.decode(String.self) {
                        self = .string(stringValue)
                        return
                    }
                    self = .parts(try singleValue.decode([Part].self))
                }
            }

            var content: Content?
        }

        var message: Message
    }

    var choices: [Choice]
}
