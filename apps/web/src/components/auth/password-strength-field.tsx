"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import {
  analyzePassword,
  type PasswordRuleId,
  type PasswordStrengthLevel,
} from "@dior/shared";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const RULE_ORDER: PasswordRuleId[] = ["length", "lower", "upper", "number", "special"];

const STRENGTH_COLORS: Record<Exclude<PasswordStrengthLevel, "empty">, string> = {
  weak: "bg-red-500",
  fair: "bg-amber-500",
  good: "bg-sky-500",
  strong: "bg-emerald-500",
};

type PasswordStrengthFieldProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
  ruleLabels: Record<PasswordRuleId, string>;
  strengthLabels: Record<Exclude<PasswordStrengthLevel, "empty">, string>;
  strengthTitle: string;
};

export function PasswordStrengthField({
  id = "password",
  name = "password",
  value,
  onChange,
  placeholder,
  autoComplete = "new-password",
  ruleLabels,
  strengthLabels,
  strengthTitle,
}: PasswordStrengthFieldProps) {
  const analysis = useMemo(() => analyzePassword(value), [value]);
  const showMeter = value.length > 0;
  const strengthLevel = analysis.level === "empty" ? "weak" : analysis.level;

  return (
    <div className="space-y-2">
      <Input
        id={id}
        name={name}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        minLength={8}
        aria-describedby={showMeter ? `${id}-strength` : undefined}
      />

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-500 ease-out",
          showMeter ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div
            id={`${id}-strength`}
            className={cn(
              "auth-password-meter space-y-3 rounded-lg border border-border/80 bg-muted/30 p-3",
              showMeter && "auth-password-meter-in",
            )}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{strengthTitle}</span>
                <span
                  className={cn(
                    "font-medium capitalize transition-colors duration-300",
                    strengthLevel === "weak" && "text-red-400",
                    strengthLevel === "fair" && "text-amber-400",
                    strengthLevel === "good" && "text-sky-400",
                    strengthLevel === "strong" && "text-emerald-400",
                  )}
                >
                  {strengthLabels[strengthLevel]}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "auth-password-bar h-full rounded-full transition-all duration-500 ease-out",
                    STRENGTH_COLORS[strengthLevel],
                  )}
                  style={{ width: `${Math.max(analysis.score, showMeter ? 8 : 0)}%` }}
                />
              </div>
            </div>

            <ul className="space-y-1.5">
              {RULE_ORDER.map((ruleId, index) => {
                const rule = analysis.rules.find((r) => r.id === ruleId);
                const met = rule?.met ?? false;
                return (
                  <li
                    key={ruleId}
                    className={cn(
                      "auth-password-rule flex items-center gap-2 text-xs transition-colors duration-300",
                      met ? "text-foreground" : "text-muted-foreground",
                    )}
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
                        met
                          ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-400 auth-password-check"
                          : "border-border bg-background/60",
                      )}
                    >
                      {met ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                    </span>
                    <span className={cn("transition-opacity duration-300", met && "opacity-90")}>
                      {ruleLabels[ruleId]}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
