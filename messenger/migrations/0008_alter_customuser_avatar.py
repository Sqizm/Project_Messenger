# Generated by Django 4.2.10 on 2024-07-02 19:21

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('messenger', '0007_alter_customuser_avatar'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customuser',
            name='avatar',
            field=models.ImageField(blank=True, default='def_avatar.png', upload_to='avatars'),
        ),
    ]
