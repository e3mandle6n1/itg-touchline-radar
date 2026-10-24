namespace Touchline.Api.Models;

public sealed class PlayerDto
{
    public int Id { get; set; }
    public string Number { get; set; } = "";
    public string Name { get; set; } = "";
    public string Pos { get; set; } = "";
    public string Role { get; set; } = "";
}
