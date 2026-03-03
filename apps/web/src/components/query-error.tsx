import { AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface QueryErrorProps {
  error: Error | null;
  retry?: () => void;
}

/**
 * 查询失败时的统一错误展示组件，提供重试能力，
 * 避免用户面对空白页面不知所措。
 */
export function QueryError({ error, retry }: QueryErrorProps) {
  return (
    <Card className="border-destructive/50">
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <div className="rounded-full bg-destructive/10 p-3 mb-4">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <h3 className="text-lg font-medium">加载失败</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          {error?.message || '发生了未知错误，请稍后重试'}
        </p>
        {retry && (
          <Button variant="outline" size="sm" className="mt-4" onClick={retry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            重试
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
