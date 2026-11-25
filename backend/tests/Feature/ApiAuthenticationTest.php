<?php

namespace Tests\Feature;

use Tests\TestCase;

class ApiAuthenticationTest extends TestCase
{
    public function test_unauthenticated_api_requests_receive_json_401_responses(): void
    {
        $this->get('/api/user', ['Accept' => '*/*'])
            ->assertUnauthorized()
            ->assertJson(['message' => 'Unauthenticated.']);
    }
}
