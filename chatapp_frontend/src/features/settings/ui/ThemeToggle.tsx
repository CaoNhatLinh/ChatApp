import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/DropdownMenu';
import { useTheme } from '@/app/providers/theme';

export function ThemeToggle() {
  const { themePreference, setThemePreference } = useTheme();

  const renderTriggerIcon = () => {
    switch (themePreference) {
      case 'dark':
        return <Moon className="h-5 w-5 text-foreground" />;
      case 'light':
        return <Sun className="h-5 w-5 text-foreground" />;
      default:
        return <Laptop className="h-5 w-5 text-foreground" />;
    }
  };

  const getMenuItemClasses = (preference: string) => {
    const baseClasses = 'flex items-center cursor-pointer transition-colors duration-150';
    const activeClasses = 'bg-accent text-accent-foreground font-semibold';
    return `${baseClasses} ${themePreference === preference ? activeClasses : ''}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          className="rounded-full hover:bg-accent/80 transition-colors"
        >
          {renderTriggerIcon()}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[160px] p-1 bg-popover text-popover-foreground border border-border shadow-xl"
      >
        <DropdownMenuItem onClick={() => setThemePreference('light')} className={getMenuItemClasses('light')}>
          <Sun className="mr-2 h-4 w-4 text-amber-500" />
          Light
          {themePreference === 'light' ? <Check className="ml-auto h-4 w-4 text-success" /> : null}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setThemePreference('dark')} className={getMenuItemClasses('dark')}>
          <Moon className="mr-2 h-4 w-4 text-blue-500" />
          Dark
          {themePreference === 'dark' ? <Check className="ml-auto h-4 w-4 text-success" /> : null}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setThemePreference('system')} className={getMenuItemClasses('system')}>
          <Laptop className="mr-2 h-4 w-4 text-cyan-500" />
          System
          {themePreference === 'system' ? <Check className="ml-auto h-4 w-4 text-success" /> : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
