<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meal_orders', function (Blueprint $table): void {
            $table->decimal('charge_amount', 12, 2)->default(0);
            $table->string('charged_invoice_id', 40)->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->foreign('charged_invoice_id')->references('id')->on('invoices')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('meal_orders', function (Blueprint $table): void {
            $table->dropForeign(['charged_invoice_id']);
            $table->dropColumn(['charge_amount', 'charged_invoice_id', 'delivered_at']);
        });
    }
};
