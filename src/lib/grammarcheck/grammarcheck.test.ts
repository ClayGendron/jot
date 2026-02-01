/**
 * Grammar Check Tests
 *
 * Tests for the grammar checking functionality.
 * Note: Harper.js requires WebAssembly which may not work in all test environments.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_DIALECT,
  SUPPORTED_DIALECTS,
  DEFAULT_IGNORED_RULES,
} from "./types";
import type {
  GrammarDialect,
  GrammarIssue,
  IgnoredRules,
} from "./types";

describe("Grammar Check Types", () => {
  describe("GrammarDialect", () => {
    it("has 4 supported dialects", () => {
      expect(SUPPORTED_DIALECTS).toHaveLength(4);
    });

    it("includes american, british, canadian, australian", () => {
      const codes = SUPPORTED_DIALECTS.map((d) => d.code);
      expect(codes).toContain("american");
      expect(codes).toContain("british");
      expect(codes).toContain("canadian");
      expect(codes).toContain("australian");
    });

    it("has american as the default dialect", () => {
      expect(DEFAULT_DIALECT).toBe("american");
    });
  });

  describe("GrammarIssue interface", () => {
    it("can create a valid grammar issue", () => {
      const issue: GrammarIssue = {
        text: "Their going",
        from: 0,
        to: 12,
        ruleId: "their_there_they_re",
        message: "Did you mean 'They're' (they are)?",
        suggestions: ["They're going"],
        category: "Grammar",
      };

      expect(issue.text).toBe("Their going");
      expect(issue.ruleId).toBe("their_there_they_re");
      expect(issue.suggestions).toHaveLength(1);
    });
  });

  describe("IgnoredRules", () => {
    it("has default ignored rules with version 1", () => {
      expect(DEFAULT_IGNORED_RULES.version).toBe(1);
      expect(DEFAULT_IGNORED_RULES.rules).toHaveLength(0);
    });

    it("can create ignored rules with entries", () => {
      const rules: IgnoredRules = {
        version: 1,
        rules: [
          { ruleId: "passive_voice", addedAt: Date.now() },
          { ruleId: "sentence_capitalization", addedAt: Date.now() },
        ],
      };

      expect(rules.rules).toHaveLength(2);
      expect(rules.rules[0].ruleId).toBe("passive_voice");
    });
  });
});

describe("Grammar Dialect Validation", () => {
  it("accepts valid dialect values", () => {
    const validDialects: GrammarDialect[] = [
      "american",
      "british",
      "canadian",
      "australian",
    ];

    validDialects.forEach((dialect) => {
      expect(SUPPORTED_DIALECTS.some((d) => d.code === dialect)).toBe(true);
    });
  });

  it("each dialect has a name", () => {
    SUPPORTED_DIALECTS.forEach((dialect) => {
      expect(dialect.name).toBeDefined();
      expect(dialect.name.length).toBeGreaterThan(0);
    });
  });
});

describe("Grammar Issue Positions", () => {
  it("calculates issue span correctly", () => {
    const issue: GrammarIssue = {
      text: "test",
      from: 10,
      to: 14,
      ruleId: "test_rule",
      message: "Test message",
      suggestions: [],
      category: "Test",
    };

    const length = issue.to - issue.from;
    expect(length).toBe(4);
    expect(length).toBe(issue.text.length);
  });

  it("handles multi-word issues", () => {
    const issue: GrammarIssue = {
      text: "should of gone",
      from: 0,
      to: 14,
      ruleId: "should_have",
      message: "Use 'should have' instead of 'should of'",
      suggestions: ["should have gone"],
      category: "Grammar",
    };

    expect(issue.to - issue.from).toBe(issue.text.length);
  });
});
