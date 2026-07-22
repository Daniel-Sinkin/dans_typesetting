import { useEffect, useMemo, useRef, type CSSProperties, type KeyboardEvent } from "react";

export interface BlockRadialAction {
  readonly id: string;
  readonly label: string;
  readonly glyph: string;
  readonly disabled?: boolean;
  readonly run: () => void;
}

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
            onClick={() => {
              action.run();
              onClose();
            }}
          >
            <span>{action.glyph}</span>
            <small>{action.label}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
