import { Sun, Moon, Laptop, Check } from "lucide-react";
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { useTheme } from '@/hooks/useTheme';
export function ThemeToggle() {
 const { themePreference, setThemePreference } = useTheme(); 

  const renderTriggerIcon = () => {
    switch (themePreference) {
      case 'dark':
        return <Moon className="h-5 w-5 text-gray-800 dark:text-gray-100" />;
      case 'light':
        return <Sun className="h-5 w-5 text-gray-800 dark:text-gray-100" />;
      case 'system':
      default:
        return <Laptop className="h-5 w-5 text-gray-800 dark:text-gray-100" />; 
    }
  };

  const getMenuItemClasses = (preference: string) => {
    const baseClasses = "flex items-center cursor-pointer transition-colors duration-150 text-gray-900 dark:text-gray-100";
    
    const activeClasses = "bg-gray-200 dark:bg-gray-700 font-semibold"; 
    
    return `${baseClasses} ${themePreference === preference ? activeClasses : ''}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          aria-label="Toggle theme" 
          className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
        >
          {renderTriggerIcon()}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-[160px] p-1 bg-white dark:bg-gray-900 shadow-xl dark:border-gray-700"
      >
        
        <DropdownMenuItem 
          onClick={() => setThemePreference('light')}
          className={getMenuItemClasses('light')} 
        >
          <Sun className="mr-2 h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          Light
          {themePreference === 'light' && <Check className="ml-auto h-4 w-4 text-teal-500 dark:text-teal-400" />}
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => setThemePreference('dark')}
          className={getMenuItemClasses('dark')}
        >
          <Moon className="mr-2 h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          Dark
          {themePreference === 'dark' && <Check className="ml-auto h-4 w-4 text-teal-500 dark:text-teal-400" />}
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => setThemePreference('system')}
          className={getMenuItemClasses('system')} 
        >
          <Laptop className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
          System
          {themePreference === 'system' && <Check className="ml-auto h-4 w-4 text-teal-500 dark:text-teal-400" />}
        </DropdownMenuItem>
        
      </DropdownMenuContent>
    </DropdownMenu>
  );
}