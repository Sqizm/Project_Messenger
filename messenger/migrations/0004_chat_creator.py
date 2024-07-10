# Generated by Django 4.2.10 on 2024-07-01 10:20

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('messenger', '0003_alter_chat_messages_alter_chat_participant'),
    ]

    operations = [
        migrations.AddField(
            model_name='chat',
            name='creator',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL),
        ),
    ]
