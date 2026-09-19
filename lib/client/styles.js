export const STYLE_ID = 'dsh-pi-ai-auth-provider-card-style';
export const styles = `
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
//# sourceMappingURL=styles.js.map