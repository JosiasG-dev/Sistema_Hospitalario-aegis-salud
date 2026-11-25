<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        abort_unless(
            $user && ($user->is_active ?? true) && $user->activeRoles()->intersect($roles)->isNotEmpty(),
            403,
            'No tiene permisos para esta operación.',
        );

        return $next($request);
    }
}
