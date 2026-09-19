window.__ModuleLoader__.load({
	id: "@dingyiliao/dsh-pi-ai-auth",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/remote.ts
		function schema(validate) {
			return { parse: validate };
		}
		function strict(name, validate) {
			return {
				mode: "strict",
				typeSymbol: name,
				create: () => schema(validate)
			};
		}
		function object(value, name) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
			return value;
		}
		function string(value, name = "value") {
			if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
			return value;
		}
		function boolean(value, name = "value") {
			if (typeof value !== "boolean") throw new TypeError(`${name} must be a boolean`);
			return value;
		}
		function authorizationEntry(value) {
			const row = object(value, "authorization entry");
			const methods = row["methods"];
			if (!Array.isArray(methods)) throw new TypeError("authorization entry methods must be an array");
			const kind = row["credentialKind"];
			if (kind !== void 0 && kind !== "api-key" && kind !== "grant") throw new TypeError("authorization credentialKind is invalid");
			return {
				key: string(row["key"], "authorization entry key"),
				label: string(row["label"], "authorization entry label"),
				methods: methods.map((method) => {
					const item = object(method, "authorization method");
					return {
						id: string(item["id"], "method id"),
						label: string(item["label"], "method label")
					};
				}),
				inFlight: boolean(row["inFlight"], "authorization entry inFlight"),
				configured: boolean(row["configured"], "authorization entry configured"),
				...kind === void 0 ? {} : { credentialKind: kind }
			};
		}
		function authorizationEntries(value) {
			if (!Array.isArray(value)) throw new TypeError("authorization entries must be an array");
			return value.map(authorizationEntry);
		}
		function authorizationFrame(value) {
			const frame = object(value, "authorization frame");
			const type = string(frame["type"], "authorization frame type");
			if (type === "started") return {
				type,
				key: string(frame["key"], "authorization key")
			};
			if (type === "notice") return {
				type,
				message: string(frame["message"], "authorization notice"),
				...frame["url"] === void 0 ? {} : { url: string(frame["url"], "authorization url") },
				...frame["code"] === void 0 ? {} : { code: string(frame["code"], "authorization code") }
			};
			if (type === "prompt-withdrawn") return {
				type,
				promptId: string(frame["promptId"], "authorization prompt id")
			};
			if (type === "settled") {
				const status = frame["status"];
				if (status !== "authorized" && status !== "cancelled") throw new TypeError("authorization status is invalid");
				return {
					type,
					status
				};
			}
			if (type === "failed") return {
				type,
				message: string(frame["message"], "authorization failure")
			};
			if (type === "prompt") {
				const prompt = object(frame["prompt"], "authorization prompt");
				const kind = prompt["kind"];
				if (kind !== "text" && kind !== "secret" && kind !== "select") throw new TypeError("authorization prompt kind is invalid");
				const options = prompt["options"];
				if (options !== void 0 && !Array.isArray(options)) throw new TypeError("prompt options must be an array");
				return {
					type,
					prompt: {
						promptId: string(prompt["promptId"], "authorization prompt id"),
						kind,
						message: string(prompt["message"], "authorization prompt message"),
						...prompt["placeholder"] === void 0 ? {} : { placeholder: string(prompt["placeholder"], "authorization prompt placeholder") },
						...options === void 0 ? {} : { options: options.map((option) => {
							const item = object(option, "authorization prompt option");
							return {
								id: string(item["id"], "option id"),
								label: string(item["label"], "option label"),
								...item["description"] === void 0 ? {} : { description: string(item["description"], "option description") }
							};
						}) }
					}
				};
			}
			throw new TypeError(`unknown authorization frame ${JSON.stringify(type)}`);
		}
		const STRING = strict("string", (value) => string(value));
		const OPTIONAL_STRING = strict("string | undefined", (value) => {
			if (value === void 0) return void 0;
			return string(value);
		});
		const BOOLEAN = strict("boolean", (value) => boolean(value));
		const ENTRIES = strict("readonly PiAiAuthorizationEntry[]", authorizationEntries);
		const FRAME = strict("PiAiAuthorizationFrame", authorizationFrame);
		const parameter = (name, codec, acceptsUndefined = false) => ({
			name,
			wire: name,
			source: "json",
			codec,
			...acceptsUndefined ? { acceptsUndefined: true } : {}
		});
		/** Strict Client contract paired with Host source-mode discovery in this bundle. */
		const PI_AI_AUTH_REMOTE = {
			package: "@dingyiliao/dsh-pi-ai-auth",
			descriptors: [
				{
					id: "@dingyiliao/dsh-pi-ai-auth:piAiAuthorization/list",
					service: "piAiAuthorization",
					namespace: "piAiAuthorization",
					method: "list",
					invocation: { kind: "direct" },
					parameters: [],
					result: ENTRIES
				},
				{
					id: "@dingyiliao/dsh-pi-ai-auth:piAiAuthorization/begin",
					service: "piAiAuthorization",
					namespace: "piAiAuthorization",
					method: "begin",
					mode: "stream",
					invocation: { kind: "direct" },
					parameters: [parameter("rawKey", STRING), parameter("method", OPTIONAL_STRING, true)],
					cancellation: { parameter: "signal" },
					result: FRAME
				},
				...["answer", "decline"].map((method) => ({
					id: `@dingyiliao/dsh-pi-ai-auth:piAiAuthorization/${method}`,
					service: "piAiAuthorization",
					namespace: "piAiAuthorization",
					method,
					invocation: { kind: "direct" },
					parameters: method === "answer" ? [
						parameter("rawKey", STRING),
						parameter("promptId", STRING),
						parameter("value", STRING)
					] : [parameter("rawKey", STRING), parameter("promptId", STRING)],
					result: BOOLEAN
				})),
				...["cancel", "signOut"].map((method) => ({
					id: `@dingyiliao/dsh-pi-ai-auth:piAiAuthorization/${method}`,
					service: "piAiAuthorization",
					namespace: "piAiAuthorization",
					method,
					invocation: { kind: "direct" },
					parameters: [parameter("rawKey", STRING)],
					result: BOOLEAN
				}))
			]
		};
		//#endregion
		//#region src/client/PiAiAuthCard.tsx
		function message(error) {
			return error instanceof Error && error.message.length > 0 ? error.message : String(error);
		}
		function remoteValue(result) {
			if (result.ok) return result.value;
			throw new Error(result.error.message);
		}
		function PiAiAuthCard({ provider, configured, authorization, t }) {
			const key = `llm-pi-ai/${provider.provider}`;
			const [entry, setEntry] = (0, react.useState)();
			const [loading, setLoading] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(false);
			const [open, setOpen] = (0, react.useState)(false);
			const [notice, setNotice] = (0, react.useState)();
			const [prompt, setPrompt] = (0, react.useState)();
			const [answer, setAnswer] = (0, react.useState)("");
			const [error, setError] = (0, react.useState)();
			const flow = (0, react.useRef)();
			const refresh = (0, react.useCallback)(async () => {
				try {
					const rows = remoteValue(await authorization.list());
					setEntry(rows.find((row) => row.key === key));
					setError(void 0);
				} catch (cause) {
					setError(t("requestFailed", { message: message(cause) }));
				} finally {
					setLoading(false);
				}
			}, [
				authorization,
				key,
				t
			]);
			(0, react.useEffect)(() => {
				refresh();
				return () => {
					flow.current?.abort("provider card unmounted");
				};
			}, [refresh]);
			const closeFlow = (0, react.useCallback)(() => {
				flow.current?.abort("authorization dialog closed");
				flow.current = void 0;
				setOpen(false);
				setBusy(false);
				setPrompt(void 0);
				setAnswer("");
				authorization.cancel(key);
			}, [authorization, key]);
			const login = (0, react.useCallback)(async () => {
				const controller = new AbortController();
				flow.current = controller;
				setBusy(true);
				setOpen(true);
				setNotice(void 0);
				setPrompt(void 0);
				setAnswer("");
				setError(void 0);
				try {
					for await (const frame of authorization.begin(key, "oauth", controller.signal)) if (frame.type === "notice") setNotice({
						message: frame.message,
						...frame.url === void 0 ? {} : { url: frame.url },
						...frame.code === void 0 ? {} : { code: frame.code }
					});
					else if (frame.type === "prompt") {
						setPrompt(frame.prompt);
						setAnswer(frame.prompt.kind === "select" ? frame.prompt.options?.[0]?.id ?? "" : "");
					} else if (frame.type === "prompt-withdrawn") setPrompt((current) => current?.promptId === frame.promptId ? void 0 : current);
					else if (frame.type === "failed") {
						setError(t("loginFailed", { message: frame.message }));
						setBusy(false);
					} else if (frame.type === "settled") {
						setBusy(false);
						if (frame.status === "authorized") setOpen(false);
					}
				} catch (cause) {
					if (!controller.signal.aborted) setError(t("loginFailed", { message: message(cause) }));
				} finally {
					if (flow.current === controller) flow.current = void 0;
					setBusy(false);
					await refresh();
				}
			}, [
				authorization,
				key,
				refresh,
				t
			]);
			const submit = (0, react.useCallback)(async () => {
				if (prompt === void 0 || answer.length === 0) return;
				try {
					remoteValue(await authorization.answer(key, prompt.promptId, answer));
				} catch (cause) {
					setError(t("loginFailed", { message: message(cause) }));
				}
			}, [
				answer,
				authorization,
				key,
				prompt,
				t
			]);
			const logout = (0, react.useCallback)(async () => {
				setBusy(true);
				setError(void 0);
				try {
					remoteValue(await authorization.signOut(key));
					await refresh();
				} catch (cause) {
					setError(t("logoutFailed", { message: message(cause) }));
				} finally {
					setBusy(false);
				}
			}, [
				authorization,
				key,
				refresh,
				t
			]);
			if (!loading && entry === void 0 && error === void 0) return null;
			const signedIn = entry?.configured === true;
			const ongoing = busy || entry?.inFlight === true;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh-pi-auth-row",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dsh-pi-auth-status",
						role: "status",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: ongoing ? "ongoing" : signedIn ? "done" : "idle" }), loading ? t("waiting") : t(!configured ? "statusUnavailable" : ongoing ? "statusSigningIn" : signedIn ? "statusSignedIn" : "statusSignedOut")]
					}), signedIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						variant: "ghost",
						disabled: ongoing,
						onClick: () => {
							logout();
						},
						children: t("logout")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						variant: "outline",
						disabled: !configured || ongoing || entry === void 0,
						onClick: () => {
							login();
						},
						children: t("login")
					})]
				}),
				error === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dsh-pi-auth-error",
					role: "alert",
					children: error
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open,
					onClose: closeFlow,
					title: t("dialogTitle", { name: entry?.label ?? provider.displayName }),
					description: t("dialogDescription"),
					closeLabel: t("close"),
					footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-pi-auth-footer",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							onClick: closeFlow,
							children: t("cancel")
						}), prompt === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: answer.length === 0,
							onClick: () => {
								submit();
							},
							children: t("submit")
						})]
					}),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-pi-auth-modal-body",
						children: [notice === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsh-pi-auth-waiting",
							children: t("noPrompt")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsh-pi-auth-notice",
								children: notice.message
							}),
							notice.url === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
								className: "dsh-pi-auth-link",
								href: notice.url,
								target: "_blank",
								rel: "noreferrer noopener",
								children: t("openPage")
							}),
							notice.code === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-pi-auth-code",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("codeLabel") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: notice.code })]
							})
						] }), prompt === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsh-pi-auth-prompt-label",
							children: prompt.message
						}), prompt.kind === "select" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							className: "dsh-pi-auth-select",
							value: answer,
							onChange: (event) => {
								setAnswer(event.target.value);
							},
							children: prompt.options?.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: option.id,
								children: option.label
							}, option.id))
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
							type: prompt.kind === "secret" ? "password" : "text",
							value: answer,
							placeholder: prompt.placeholder,
							autoFocus: true,
							onChange: (event) => {
								setAnswer(event.target.value);
							},
							onKeyDown: (event) => {
								if (event.key === "Enter") submit();
							}
						})] })]
					})
				})
			] });
		}
		//#endregion
		//#region src/client/locales.ts
		const NS = "piAiAuth";
		const en = {
			statusSignedIn: "Signed in",
			statusSignedOut: "Not signed in",
			statusSigningIn: "Signing in…",
			statusUnavailable: "Save this provider before signing in",
			login: "Sign in",
			logout: "Sign out",
			cancel: "Cancel",
			submit: "Continue",
			close: "Close",
			dialogTitle: "{name} sign in",
			dialogDescription: "Complete the provider authorization flow. Credentials are stored by the provider integration.",
			openPage: "Open sign-in page",
			codeLabel: "Authorization code",
			waiting: "Waiting for the provider…",
			loginFailed: "Sign-in failed: {message}",
			logoutFailed: "Could not sign out: {message}",
			requestFailed: "Could not read authorization state: {message}",
			noPrompt: "Follow the instructions in your browser. This window will update automatically."
		};
		const zh = {
			statusSignedIn: "已登录",
			statusSignedOut: "未登录",
			statusSigningIn: "正在登录…",
			statusUnavailable: "保存此 Provider 后即可登录",
			login: "登录",
			logout: "退出登录",
			cancel: "取消",
			submit: "继续",
			close: "关闭",
			dialogTitle: "{name} 登录",
			dialogDescription: "完成 Provider 的授权流程。凭据由对应的 Provider 集成负责保存。",
			openPage: "打开登录页面",
			codeLabel: "授权码",
			waiting: "正在等待 Provider…",
			loginFailed: "登录失败：{message}",
			logoutFailed: "退出登录失败：{message}",
			requestFailed: "无法读取授权状态：{message}",
			noPrompt: "请按照浏览器中的说明操作；完成后这里会自动更新。"
		};
		//#endregion
		//#region src/client/styles.ts
		const STYLE_ID = "dsh-pi-ai-auth-provider-card-style";
		const styles = `
.dsh-pi-auth-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 28px;
  padding-top: 10px;
  border-top: 0.5px solid var(--dsw-alias-border-l4);
}
.dsh-pi-auth-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
.dsh-pi-auth-row > button { margin-left: auto; flex: none; }
.dsh-pi-auth-error {
  margin: 8px 0 0;
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
  line-height: 18px;
}
.dsh-pi-auth-modal-body { display: flex; flex-direction: column; gap: 14px; }
.dsh-pi-auth-notice,
.dsh-pi-auth-waiting,
.dsh-pi-auth-prompt-label {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 14px;
  line-height: 22px;
}
.dsh-pi-auth-link {
  color: var(--dsw-alias-brand-primary);
  font-size: 14px;
  line-height: 22px;
  text-decoration: none;
}
.dsh-pi-auth-link:hover { text-decoration: underline; }
.dsh-pi-auth-code {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: 10px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}
.dsh-pi-auth-code code { color: var(--dsw-alias-label-primary); font-size: 14px; user-select: all; }
.dsh-pi-auth-select {
  box-sizing: border-box;
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
}
.dsh-pi-auth-footer { display: flex; justify-content: flex-end; gap: 8px; }
`;
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"remote",
			"slots",
			"locale"
		];
		function registerProviderCard(ctx) {
			ctx.slots.inject("settings.models.provider-card", () => ctx.slots.register({
				name: "settings.models.provider-card",
				key: "llm-pi-ai",
				locale: NS,
				inject: () => ({ authorization: ctx.remote.piAiAuthorization })
			}, PiAiAuthCard));
		}
		/** Mount the bundle-owned Remote contract and contribute the pi-ai provider-card controls. */
		async function apply(ctx) {
			const disposeRemote = await ctx.remote.$mount(PI_AI_AUTH_REMOTE);
			ctx.effect(() => disposeRemote, "pi-ai-auth: Remote contribution");
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "pi-ai-auth: dictionaries");
			ctx.effect(() => {
				if (document.getElementById("dsh-pi-ai-auth-provider-card-style") !== null) return () => {};
				const style = document.createElement("style");
				style.id = STYLE_ID;
				style.textContent = styles;
				document.head.append(style);
				return () => {
					style.remove();
				};
			}, "pi-ai-auth: provider-card styles");
			await ctx.inject([
				"remote.piAiAuthorization",
				"slots",
				"locale"
			], registerProviderCard);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map