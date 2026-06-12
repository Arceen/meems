"use client";

interface ToggleGroupProps<T extends string | number> {
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
}

export default function ToggleGroup<T extends string | number>({ options, value, onChange }: ToggleGroupProps<T>) {
    return (
        <div style={{ display: 'flex', gap: '1rem' }}>
            {options.map(option => (
                <button
                    key={String(option.value)}
                    className={`btn ${value === option.value ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => onChange(option.value)}
                    style={{ flex: 1 }}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
