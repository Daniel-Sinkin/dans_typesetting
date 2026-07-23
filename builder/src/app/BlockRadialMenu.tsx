import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

interface BlockRadialActionBase {
  readonly id: string;
  readonly label: string;
  readonly glyph: string;
  readonly disabled?: boolean;
}

export interface BlockRadialCommandAction extends BlockRadialActionBase {
  readonly kind?: "command";
  readonly run: () => void;
}

export interface BlockRadialBranchItem {
  readonly id: string;
  readonly label: string;
  readonly glyph: string;
  readonly preview: ReactNode;
  readonly run: () => void;
}

export interface BlockRadialBranchAction extends BlockRadialActionBase {
  readonly kind: "branch";
  readonly items: readonly BlockRadialBranchItem[];
}

export type BlockRadialAction = BlockRadialCommandAction | BlockRadialBranchAction;

interface BlockRadialMenuProps {
  readonly label: string;
  readonly glyph: string;
  readonly clientX: number;
  readonly clientY: number;
  readonly actions: readonly BlockRadialAction[];
  readonly onClose: () => void;
}

const menuRadius = 86;
const viewportMargin = 116;

function actionPosition(index: number, count: number): CSSProperties {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
  return {
    transform: `translate(-50%, -50%) translate(${String(Math.cos(angle) * menuRadius)}px, ${String(Math.sin(angle) * menuRadius)}px)`,
  };
}

export function BlockRadialMenu({
  label,
  glyph,
  clientX,
  clientY,
  actions,
  onClose,
}: BlockRadialMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const center = useMemo(
    () => ({
      x: Math.min(globalThis.innerWidth - viewportMargin, Math.max(viewportMargin, clientX)),
      y: Math.min(globalThis.innerHeight - viewportMargin, Math.max(viewportMargin, clientY)),
    }),
    [clientX, clientY],
  );

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']:not(:disabled)")?.focus();
  }, []);

  const cycleFocus = (event: KeyboardEvent<HTMLDivElement>, direction: -1 | 1): void => {
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not(:disabled)") ?? [])];
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = (currentIndex + direction + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
    event.preventDefault();
  };
  const expandedAction = actions.find(
    (action): action is BlockRadialBranchAction =>
      action.kind === "branch" && action.id === expandedActionId,
  );
  const submenuHeight = Math.min(520, 18 + (expandedAction?.items.length ?? 0) * 106);
  const submenuTop = Math.min(
    globalThis.innerHeight - 16 - submenuHeight,
    Math.max(16, center.y - submenuHeight / 2),
  ) - center.y;
  const submenuOnLeft = center.x > globalThis.innerWidth - 390;

  return (
    <div
      className="block-radial-backdrop"
      data-testid="block-radial-menu"
      onContextMenu={(event) => {
        event.preventDefault();
      }}
      onPointerDown={() => {
        onClose();
      }}
    >
      <div
        ref={menuRef}
        className="block-radial-menu"
        role="menu"
        aria-label={`${label} actions`}
        style={{ left: center.x, top: center.y }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            cycleFocus(event, 1);
          } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            cycleFocus(event, -1);
          }
        }}
      >
        <button
          className="block-radial-menu__center"
          type="button"
          aria-label="Close block actions"
          title={label}
          onClick={() => {
            onClose();
          }}
        >
          <span>{glyph}</span>
        </button>
        {actions.map((action, index) => (
          <button
            key={action.id}
            className={`block-radial-menu__action block-radial-menu__action--${action.id}`}
            type="button"
            role="menuitem"
            disabled={action.disabled}
            style={actionPosition(index, actions.length)}
            aria-haspopup={action.kind === "branch" ? "menu" : undefined}
            aria-expanded={
              action.kind === "branch" ? expandedActionId === action.id : undefined
            }
            onPointerEnter={() => {
              setExpandedActionId(action.kind === "branch" ? action.id : null);
            }}
            onFocus={() => {
              setExpandedActionId(action.kind === "branch" ? action.id : null);
            }}
            onClick={() => {
              if (action.kind === "branch") {
                setExpandedActionId((current) => current === action.id ? null : action.id);
              } else {
                action.run();
                onClose();
              }
            }}
          >
            <span>{action.glyph}</span>
            <small>{action.label}</small>
          </button>
        ))}
        {expandedAction === undefined ? null : (
          <div
            className={`block-radial-menu__submenu block-radial-menu__submenu--${submenuOnLeft ? "left" : "right"}`}
            role="menu"
            aria-label={expandedAction.label}
            style={{ top: submenuTop }}
            onPointerEnter={() => {
              setExpandedActionId(expandedAction.id);
            }}
          >
            {expandedAction.items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className="block-radial-menu__submenu-item"
                onClick={() => {
                  item.run();
                  onClose();
                }}
              >
                <span className="block-radial-menu__submenu-heading">
                  <b>{item.glyph}</b>
                  <strong>{item.label}</strong>
                </span>
                <span className="block-radial-menu__submenu-preview">
                  {item.preview}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
